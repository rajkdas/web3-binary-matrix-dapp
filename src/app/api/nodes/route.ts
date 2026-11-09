import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { compressedUpline, type NodeStatus } from "@/lib/indexer";
import { loadMatrix, makeTx, relayEvent } from "@/lib/server-indexer";
import { ensureReady } from "@/lib/ensure-ready";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/nodes — registry-signer action: set node status.
 * Suspending a node is what triggers upline compression for every split
 * that would otherwise route through it.
 */
export async function PATCH(req: NextRequest) {
  await ensureReady();
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  const status = b?.status as NodeStatus;
  if (!id || !["ACTIVE", "GRACE", "SUSPENDED"].includes(status)) {
    return NextResponse.json({ error: "id and valid status required" }, { status: 400 });
  }

  const users = await loadMatrix();
  const node = users.find((u) => u.id === id);
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  await db.user.update({ where: { id }, data: { status } });

  let headline: string;
  if (status === "SUSPENDED") {
    // find the first active ancestor — that's where splits now route
    const up = compressedUpline(users, id, 1).beneficiaries[0];
    headline = `Upline #${id} suspended — splits compress to ${up ? `#${up.id} ${up.name}` : "root"}`;
  } else if (status === "ACTIVE") {
    headline = `Node #${id} re-activated — ${node.name} rejoins the split paths`;
  } else {
    headline = `Node #${id} moved to grace review`;
  }

  const ev = {
    type: status === "ACTIVE" ? "ACTIVATION" : "COMPRESSION",
    txHash: makeTx(),
    blockNumber: 4_938_400 + Math.floor(Math.random() * 90),
    actorId: id,
    actorName: node.name,
    headline,
    detail: JSON.stringify({ id, status, previous: node.status }),
    amount: null,
  };
  await db.event.create({ data: ev });
  await relayEvent({ ...ev, id: `live-${Date.now()}`, createdAt: new Date().toISOString(), live: true });

  return NextResponse.json({ ok: true, headline });
}
