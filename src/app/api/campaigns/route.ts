import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { makeTx } from "@/lib/server-indexer";
import { ensureReady } from "@/lib/ensure-ready";

export const dynamic = "force-dynamic";

/** GET /api/campaigns — campaign registry mirror. */
export async function GET() {
  await ensureReady();
  const campaigns = await db.campaign.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(campaigns.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
}

/** POST /api/campaigns — deploy a new Campaign proxy config. */
export async function POST(req: NextRequest) {
  await ensureReady();
  const b = await req.json().catch(() => null);
  const name = (b?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const entryFee = Math.max(0, Number(b?.entryFee) || 0);
  const referralPct = Math.min(50, Math.max(0, Number(b?.referralPct) || 0));
  const poolPct = Math.min(50, Math.max(0, Number(b?.poolPct) || 0));
  const treasuryPct = Math.min(20, Math.max(0, Number(b?.treasuryPct) || 0));
  const poolDepth = Math.min(12, Math.max(1, Number(b?.poolDepth) || 5));

  if (referralPct + poolPct + treasuryPct > 60) {
    return NextResponse.json({ error: "Total split cannot exceed 60%" }, { status: 422 });
  }

  const c = await db.campaign.create({
    data: {
      id: `c-${Date.now().toString(36)}`,
      name,
      description: (b?.description ?? "").trim() || "Custom campaign",
      entryFee, referralPct, poolPct, treasuryPct, poolDepth,
      active: true,
      optIns: 0,
    },
  });

  await db.event.create({
    data: {
      type: "CAMPAIGN_DEPLOY",
      txHash: makeTx(),
      blockNumber: 4_938_400 + Math.floor(Math.random() * 90),
      actorId: null,
      actorName: "Admin",
      headline: `Campaign "${name}" deployed — ${referralPct}% referral / ${poolPct}% pool / ${treasuryPct}% treasury`,
      detail: JSON.stringify({ campaignId: c.id, entryFee, poolDepth }),
      amount: null,
    },
  });

  return NextResponse.json({ ...c, createdAt: c.createdAt.toISOString() });
}

/** PATCH /api/campaigns — toggle a campaign's active flag. */
export async function PATCH(req: NextRequest) {
  await ensureReady();
  const b = await req.json().catch(() => null);
  const { id, active } = b ?? {};
  if (!id || typeof active !== "boolean") {
    return NextResponse.json({ error: "id and active required" }, { status: 400 });
  }
  const c = await db.campaign.update({ where: { id }, data: { active } });
  return NextResponse.json({ ...c, createdAt: c.createdAt.toISOString() });
}
