import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Zero-config database URL resolution:
 *  1. DATABASE_URL env var (local dev / custom deployments);
 *  2. Vercel serverless → ephemeral /tmp file, auto-created & seeded on
 *     cold start by src/lib/ensure-ready.ts;
 *  3. everything else → db/custom.db in the project root.
 */
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.VERCEL) return "file:/tmp/binarymatrix.db";
  const file = path.join(process.cwd(), "db", "custom.db");
  fs.mkdirSync(path.dirname(file), { recursive: true }); // SQLite won't create parent dirs
  return `file:${file}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
