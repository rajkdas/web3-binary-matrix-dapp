/**
 * CLI reseed — optional helper: `npm run db:seed`
 * The app also auto-seeds an empty database on first API request
 * (see src/lib/ensure-ready.ts), so this is only needed to RESET a
 * database that already contains data (e.g. after demo signups).
 */
import { db } from "../src/lib/db";
import { seedNetwork } from "../src/lib/seed";

seedNetwork(db)
  .then(() => console.log("✓ reseed complete"))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
