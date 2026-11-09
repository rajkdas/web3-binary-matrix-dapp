/**
 * DDL bootstrap — mirrors prisma/schema.prisma exactly.
 *
 * Generated with:  prisma migrate diff --from-empty \
 *                    --to-schema-datamodel prisma/schema.prisma --script
 *
 * Why: on ephemeral serverless filesystems (e.g. Vercel's /tmp) the SQLite
 * file does not exist between deploys, so the API layer creates the tables
 * on cold start and seeds the demo network — zero manual migration steps.
 * Every statement is idempotent (IF NOT EXISTS).
 */
export const BOOTSTRAP_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "email" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'email',
    "avatarSeed" TEXT NOT NULL,
    "side" TEXT,
    "parentId" INTEGER,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "sponsorId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "package" TEXT NOT NULL DEFAULT 'STARTER',
    "pkgAmount" REAL NOT NULL DEFAULT 0,
    "isFounder" BOOLEAN NOT NULL DEFAULT false,
    "leftVol" REAL NOT NULL DEFAULT 0,
    "rightVol" REAL NOT NULL DEFAULT 0,
    "totalEarned" REAL NOT NULL DEFAULT 0,
    "heldAmount" REAL NOT NULL DEFAULT 0,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  `CREATE TABLE IF NOT EXISTS "Earning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "fromId" INTEGER,
    "fromName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RELEASED',
    "heldUntil" DATETIME,
    "campaignId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Earning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
)`,
  `CREATE TABLE IF NOT EXISTS "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "actorId" INTEGER,
    "actorName" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "detail" TEXT,
    "amount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
)`,
  `CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entryFee" REAL NOT NULL,
    "referralPct" REAL NOT NULL,
    "poolPct" REAL NOT NULL,
    "treasuryPct" REAL NOT NULL,
    "poolDepth" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "optIns" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_handle_key" ON "User"("handle")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_wallet_key" ON "User"("wallet")`,
];
