/**
 * Runtime auto-bootstrap — makes the app zero-config everywhere.
 *
 * On the first API request (per server instance) it:
 *   1. creates any missing tables (idempotent DDL, see bootstrap-sql.ts);
 *   2. seeds the 45-node demo network if the database is empty.
 *
 * This is what lets the demo run on ephemeral serverless filesystems
 * (Vercel /tmp) with no migration or seed step, while behaving identically
 * on a laptop (`npm run dev`) or a VPS.
 */
import { db } from "./db";
import { BOOTSTRAP_SQL } from "./bootstrap-sql";
import { seedNetwork } from "./seed";

const globalForBootstrap = globalThis as unknown as { __binarymatrixReady?: Promise<void> };

async function bootstrap() {
  for (const stmt of BOOTSTRAP_SQL) {
    await db.$executeRawUnsafe(stmt);
  }
  const users = await db.user.count();
  if (users === 0) {
    console.log("[binarymatrix] empty database — seeding demo network…");
    await seedNetwork(db);
  }
}

/** Await this at the top of every API handler before touching the database. */
export function ensureReady(): Promise<void> {
  if (!globalForBootstrap.__binarymatrixReady) {
    globalForBootstrap.__binarymatrixReady = bootstrap().catch((err) => {
      // allow the next request to retry (e.g. a transient SQLite lock)
      globalForBootstrap.__binarymatrixReady = undefined;
      throw err;
    });
  }
  return globalForBootstrap.__binarymatrixReady;
}
