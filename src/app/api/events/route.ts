import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/ensure-ready";

export const dynamic = "force-dynamic";

/** GET /api/events — recent chain events (feed hydration before socket connects). */
export async function GET() {
  await ensureReady();
  const events = await db.event.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json(
    events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))
  );
}
