import { db } from "@/lib/db";
import { recomputeVolumes, type MatrixUser, type PackageTier, type NodeStatus, type Side } from "@/lib/indexer";
import { io } from "socket.io-client";

/** Load the full matrix mirror from Postgres and shape it as MatrixUser[]. */
export async function loadMatrix(): Promise<MatrixUser[]> {
  const rows = await db.user.findMany({ orderBy: { id: "asc" } });
  return rows.map((r) => ({
    ...r,
    side: (r.side ?? null) as Side | null,
    status: r.status as NodeStatus,
    package: r.package as PackageTier,
    joinedAt: r.joinedAt.toISOString(),
    activatedAt: r.activatedAt.toISOString(),
  }));
}

/** Recompute subtree volumes off-chain and persist the cache columns. */
export async function persistVolumes(users: MatrixUser[]) {
  const vols = recomputeVolumes(users);
  await Promise.all(
    users.map((u) =>
      db.user.update({
        where: { id: u.id },
        data: {
          leftVol: vols.get(u.id)!.leftVol,
          rightVol: vols.get(u.id)!.rightVol,
        },
      })
    )
  );
}

const HEX = "0123456789abcdef";
export function makeWallet(id: number) {
  let x = (id * 2654435761) >>> 0;
  let w = "0x";
  for (let i = 0; i < 40; i++) {
    x = (x ^ (x << 13)) >>> 0; x = (x ^ (x >>> 17)) >>> 0; x = (x ^ (x << 5)) >>> 0;
    w += HEX[x % 16];
  }
  return w;
}
export function makeTx() {
  let x = Date.now() >>> 0;
  let w = "0x";
  for (let i = 0; i < 64; i++) {
    x = (x ^ (x << 13)) >>> 0; x = (x ^ (x >>> 17)) >>> 0; x = (x ^ (x << 5)) >>> 0;
    w += HEX[x % 16];
  }
  return w;
}

/**
 * Persistent socket to the event-stream service (server-to-server, direct
 * port — never through the gateway). Broadcasts chain events produced by the
 * API to every connected dashboard feed. Never throws.
 */
const globalForFeed = globalThis as unknown as { feedSocket?: ReturnType<typeof io> };
function feedSocket() {
  if (!globalForFeed.feedSocket) {
    globalForFeed.feedSocket = io("http://127.0.0.1:3003", {
      path: "/",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 3,
      timeout: 2000,
    });
  }
  return globalForFeed.feedSocket;
}

/** Best-effort relay of a chain event to the live feed. */
export async function relayEvent(event: Record<string, unknown>) {
  try {
    const s = feedSocket();
    const payload = {
      ...event,
      id: event.id ?? `live-${Date.now()}`,
      createdAt: event.createdAt ?? new Date().toISOString(),
    };
    if (s.connected) {
      s.emit("relay:event", payload);
    } else {
      s.once("connect", () => {
        try { s.emit("relay:event", payload); } catch { /* ambient feed only */ }
      });
    }
  } catch {
    // feed is ambient — never block the write path on it
  }
}
