import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { makeTx, relayEvent } from "@/lib/server-indexer";
import { ensureReady } from "@/lib/ensure-ready";

export const dynamic = "force-dynamic";

/** GET /api/holding — SafetyHolding ledger: every HELD earning + totals. */
export async function GET() {
  await ensureReady();
  const [held, totals] = await Promise.all([
    db.earning.findMany({
      where: { status: "HELD" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } } },
    }),
    db.earning.groupBy({
      by: ["status"],
      _sum: { amount: true },
      _count: true,
    }),
  ]);
  return NextResponse.json({
    held: held.map((e) => ({
      id: e.id,
      userId: e.userId,
      userName: e.user.name,
      kind: e.kind,
      amount: e.amount,
      fromId: e.fromId,
      fromName: e.fromName,
      heldUntil: e.heldUntil?.toISOString() ?? null,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
    totals: Object.fromEntries(totals.map((t) => [t.status, { sum: t._sum.amount ?? 0, count: t._count }])),
  });
}

/**
 * PATCH /api/holding
 * {earningId, action:"release"|"reverse"} — safety-signer controls
 * {action:"releaseAllDue"} — crank: release every hold past its grace window
 */
export async function PATCH(req: NextRequest) {
  await ensureReady();
  const b = await req.json().catch(() => null);
  const action: string = b?.action;

  if (action === "releaseAllDue") {
    const due = await db.earning.findMany({
      where: { status: "HELD", heldUntil: { lte: new Date() } },
    });
    let sum = 0;
    for (const e of due) {
      await db.earning.update({ where: { id: e.id }, data: { status: "RELEASED", heldUntil: null } });
      const u = await db.user.findUnique({ where: { id: e.userId } });
      if (u) await db.user.update({ where: { id: e.userId }, data: { heldAmount: Math.max(0, u.heldAmount - e.amount) } });
      sum += e.amount;
    }
    if (due.length > 0) {
      const ev = {
        type: "HOLD_RELEASE",
        txHash: makeTx(),
        blockNumber: 4_938_400 + Math.floor(Math.random() * 90),
        actorId: null,
        actorName: "Safety Signer",
        headline: `SafetyHolding crank released ${sum.toFixed(1)} USDT across ${due.length} matured hold${due.length > 1 ? "s" : ""}`,
        amount: +sum.toFixed(2),
      };
      await db.event.create({ data: { ...ev, detail: JSON.stringify({ released: due.length }) } });
      await relayEvent({ ...ev, id: `live-${Date.now()}`, createdAt: new Date().toISOString(), live: true });
    }
    return NextResponse.json({ released: due.length, amount: +sum.toFixed(2) });
  }

  const { earningId } = b ?? {};
  if (!earningId || !["release", "reverse"].includes(action)) {
    return NextResponse.json({ error: "earningId and valid action required" }, { status: 400 });
  }

  const e = await db.earning.findUnique({ where: { id: earningId } });
  if (!e || e.status !== "HELD") {
    return NextResponse.json({ error: "Hold not found or already settled" }, { status: 404 });
  }

  const status = action === "release" ? "RELEASED" : "REVERSED";
  await db.earning.update({ where: { id: earningId }, data: { status, heldUntil: null } });
  const u = await db.user.findUnique({ where: { id: e.userId } });
  if (u) {
    await db.user.update({
      where: { id: e.userId },
      data: {
        heldAmount: Math.max(0, u.heldAmount - e.amount),
        totalEarned: action === "reverse" ? Math.max(0, u.totalEarned - e.amount) : u.totalEarned,
      },
    });
  }

  const ev = {
    type: action === "release" ? "HOLD_RELEASE" : "HOLD_REVERSE",
    txHash: makeTx(),
    blockNumber: 4_938_400 + Math.floor(Math.random() * 90),
    actorId: e.userId,
    actorName: u?.name ?? `#${e.userId}`,
    headline:
      action === "release"
        ? `SafetyHolding released ${e.amount.toFixed(1)} USDT to #${e.userId}`
        : `SafetyHolding reversed ${e.amount.toFixed(1)} USDT from #${e.userId} (upline protection)`,
    amount: e.amount,
    detail: JSON.stringify({ earningId: e.id, kind: e.kind }),
  };
  await db.event.create({ data: ev });
  await relayEvent({ ...ev, id: `live-${Date.now()}`, createdAt: new Date().toISOString(), live: true });

  return NextResponse.json({ ok: true, status });
}
