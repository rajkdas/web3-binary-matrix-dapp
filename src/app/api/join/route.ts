import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  findBFSPlacement,
  computeFeeSplits,
  compressedUpline,
  recomputeVolumes,
  PKG_PRICE,
  GRACE_HOURS,
  type PackageTier,
} from "@/lib/indexer";
import { loadMatrix, persistVolumes, makeWallet, makeTx, relayEvent } from "@/lib/server-indexer";
import { ensureReady } from "@/lib/ensure-ready";

export const dynamic = "force-dynamic";

/**
 * POST /api/join — "Web2.5 activation"
 *
 * Mirrors the on-chain call chain  Registry.register(sponsor, preferSide)
 *                                 → CampaignManager.optIn(pkg)
 *                                 → Campaign.splitFee()
 *                                 → SafetyHolding.hold(poolShare, 72h)
 * except the BFS search runs here, off-chain, for ~zero marginal gas.
 */
export async function POST(req: NextRequest) {
  await ensureReady();
  const body = await req.json().catch(() => null);
  const sponsorId = Number(body?.sponsorId);
  const name: string = (body?.name ?? "").trim();
  const email: string | null = body?.email ?? null;
  const provider: string = body?.provider ?? "email";
  const pkg: PackageTier = (["STARTER", "GROWTH", "SCALE"] as const).includes(body?.package)
    ? body.package
    : "STARTER";
  const preferSide: "L" | "R" | undefined = body?.preferSide === "L" || body?.preferSide === "R" ? body.preferSide : undefined;

  if (!sponsorId || !name) {
    return NextResponse.json({ error: "sponsorId and name are required" }, { status: 400 });
  }

  const users = await loadMatrix();
  const sponsor = users.find((u) => u.id === sponsorId);
  if (!sponsor) return NextResponse.json({ error: "Unknown sponsor" }, { status: 404 });

  // 1) BFS placement off-chain (the gas-saving core of the protocol)
  const placement = findBFSPlacement(users, sponsorId, preferSide);
  if (!placement) {
    return NextResponse.json({ error: "Matrix is saturated" }, { status: 409 });
  }

  // 2) pick campaign by tier (Founders for SCALE, Launch otherwise)
  const campaigns = await db.campaign.findMany({ where: { active: true } });
  const campaign =
    campaigns.find((c) => c.entryFee === PKG_PRICE[pkg] && c.entryFee > 0) ??
    campaigns.find((c) => c.id === "c-launch") ??
    campaigns[0];
  if (!campaign) return NextResponse.json({ error: "No active campaign" }, { status: 409 });

  // 3) mint the SBT-bound position
  const maxId = users.reduce((m, u) => Math.max(m, u.id), 1000);
  const id = maxId + 1;
  const parent = users.find((u) => u.id === placement.parentId)!;
  const now = new Date();
  const newUser = await db.user.create({
    data: {
      id,
      name,
      handle: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}.${id}`,
      wallet: makeWallet(id),
      email,
      provider,
      avatarSeed: name,
      side: placement.side,
      parentId: placement.parentId,
      depth: parent.depth + 1,
      sponsorId,
      status: "GRACE", // fresh activations sit in the 72h upline-protection window
      package: pkg,
      pkgAmount: PKG_PRICE[pkg],
      joinedAt: now,
      activatedAt: now,
    },
  });

  // 4) instant campaign fee split — referral compresses over inactive ancestors
  const splits = computeFeeSplits(
    users.map((u) => ({ ...u })),
    { ...campaign, active: campaign.active },
    PKG_PRICE[pkg],
    sponsorId,
    placement.parentId
  );

  const txHash = makeTx();
  const blockNumber = 4_938_400 + Math.floor(Math.random() * 90);
  const heldUntil = new Date(now.getTime() + GRACE_HOURS * 3600_000);

  for (const s of splits) {
    if (s.kind === "TREASURY") continue; // not a matrix node
    await db.earning.create({
      data: {
        userId: s.toId,
        kind: s.kind === "REFERRAL" ? "REFERRAL" : "SPLIT_POOL",
        amount: s.usdt,
        fromId: id,
        fromName: name,
        status: s.held ? "HELD" : "RELEASED",
        heldUntil: s.held ? heldUntil : null,
        campaignId: campaign.id,
        note: s.note,
        createdAt: now,
      },
    });
    const payee = await db.user.findUnique({ where: { id: s.toId } });
    if (payee) {
      await db.user.update({
        where: { id: s.toId },
        data: {
          totalEarned: payee.totalEarned + s.usdt,
          heldAmount: payee.heldAmount + (s.held ? s.usdt : 0),
        },
      });
    }
  }

  // 5) chain events (what the contracts would emit)
  await db.event.createMany({
    data: [
      {
        type: "JOIN",
        txHash,
        blockNumber,
        actorId: id,
        actorName: name,
        headline: `${name} activated #${id} · ${pkg} package${placement.spillover ? " (BFS spillover placement)" : ""}`,
        detail: JSON.stringify({
          position: id, parent: placement.parentId, side: placement.side,
          sponsor: sponsorId, pkg, spillover: placement.spillover,
          provider,
        }),
        amount: PKG_PRICE[pkg],
        createdAt: now,
      },
      {
        type: "FEE_SPLIT",
        txHash,
        blockNumber,
        actorId: id,
        actorName: name,
        headline: `Fee split ${splits.reduce((s, l) => s + l.usdt, 0).toFixed(1)} USDT on #${id} activation — ${splits.filter((s) => s.kind !== "TREASURY").length} beneficiaries`,
        detail: JSON.stringify({ splits }),
        amount: +splits.reduce((s, l) => s + l.usdt, 0).toFixed(2),
        createdAt: now,
      },
    ],
  });
  await db.campaign.update({ where: { id: campaign.id }, data: { optIns: { increment: 1 } } });

  // 6) roll up volumes (indexer housekeeping) + persist cache
  await persistVolumes(await loadMatrix());

  // 7) relay to the live feed so every open dashboard sees it instantly
  await relayEvent({
    id: `live-${Date.now()}`,
    type: "JOIN",
    txHash,
    blockNumber,
    actorId: id,
    actorName: name,
    headline: `${name} activated #${id} · ${pkg} package${placement.spillover ? " (BFS spillover placement)" : ""}`,
    amount: PKG_PRICE[pkg],
    createdAt: now.toISOString(),
    live: true,
  });

  const fresh = await loadMatrix();
  const serialized = fresh.find((u) => u.id === id)!;
  return NextResponse.json({
    user: serialized,
    placement: { ...placement, parentName: parent.name },
    splits,
    campaignId: campaign.id,
    txHash,
    blockNumber,
    volumeCheck: recomputeVolumes(fresh).get(1001),
    compression: compressedUpline(fresh, id, 5),
  });
}
