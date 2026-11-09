import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadMatrix } from "@/lib/server-indexer";
import { ensureReady } from "@/lib/ensure-ready";

export const dynamic = "force-dynamic";

/**
 * GET /api/network
 * One-shot snapshot of the off-chain mirror: full matrix, recomputed volumes,
 * recent chain events, campaign registry and earnings ledger.
 * The dashboard, matrix view, analytics and admin console all subscribe to this.
 */
export async function GET() {
  await ensureReady();
  const [users, rawEvents, campaigns, rawEarnings] = await Promise.all([
    loadMatrix(),
    db.event.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    db.campaign.findMany({ orderBy: { createdAt: "asc" } }),
    db.earning.findMany({ orderBy: { createdAt: "desc" }, take: 400 }),
  ]);

  return NextResponse.json({
    users,
    events: rawEvents.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    earnings: rawEarnings.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      heldUntil: e.heldUntil?.toISOString() ?? null,
    })),
    campaigns: campaigns.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    meta: {
      chainId: 84532,
      chain: "Base Sepolia (demo)",
      registry: "0x7fa9385be102ac3eac297483dd6233d62b3e1496",
      lastIndexedBlock: 4_938_412,
      indexerLagMs: 820,
      generatedAt: new Date().toISOString(),
    },
  });
}
