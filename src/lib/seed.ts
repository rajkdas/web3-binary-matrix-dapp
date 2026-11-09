/**
 * PortaGraph demo seed — mirrors what the off-chain Indexer would persist
 * after listening to Registry events on Base L2.
 *
 * Network shape (2xN Binary Forced Matrix, 45 nodes, 5 levels):
 *  L1: 2 · L2: 4 · L3: 8 · L4: 16 · L5: 14 (incl. BFS spillover placements)
 *  - #1006 and #1021 are SUSPENDED  → used to demo upline compression
 *  - #1043 / #1044 / #1045 joined < 72h ago → GRACE (SafetyHolding window)
 *  - 6 nodes have sponsorId ≠ parentId → real spillover evidence
 *
 * Shared by the CLI reseed (`npm run db:seed`) and the runtime auto-bootstrap
 * (src/lib/ensure-ready.ts) that seeds ephemeral serverless databases.
 */
import { PrismaClient } from "@prisma/client";

// deterministic PRNG so wallets/txhashes are stable across reseeds
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(42);
const hex = (n: number) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(rnd() * 16)]).join("");
const wallet = (i: number) => `0x${hex(4)}${(0x1000 + i * 7).toString(16)}${hex(52)}`.slice(0, 42);
const txHash = (i: number) => `0x${hex(8)}${(0x2c4e00 + i).toString(16)}${hex(48)}`;

const PKG = { STARTER: 100, GROWTH: 500, SCALE: 1500 } as const;
const DAY = 86_400_000;
const NOW = Date.now();

interface Row {
  id: number; name: string; side: "L" | "R" | null; parent: number | null;
  sponsor: number | null; pkg: keyof typeof PKG; daysAgo: number;
  status?: "ACTIVE" | "GRACE" | "SUSPENDED"; founder?: boolean; email?: string;
}

const rows: Row[] = [
  { id: 1001, name: "Alex Carter", side: null, parent: null, sponsor: null, pkg: "SCALE", daysAgo: 34, founder: true, email: "alex@portagraph.io" },
  // L1
  { id: 1002, name: "Maya Okafor", side: "L", parent: 1001, sponsor: 1001, pkg: "SCALE", daysAgo: 32 },
  { id: 1003, name: "Diego Ramirez", side: "R", parent: 1001, sponsor: 1001, pkg: "GROWTH", daysAgo: 31 },
  // L2
  { id: 1004, name: "Sarah Lindqvist", side: "L", parent: 1002, sponsor: 1002, pkg: "GROWTH", daysAgo: 28 },
  { id: 1005, name: "James Whitfield", side: "R", parent: 1002, sponsor: 1002, pkg: "SCALE", daysAgo: 27 },
  { id: 1006, name: "Priya Natarajan", side: "L", parent: 1003, sponsor: 1003, pkg: "GROWTH", daysAgo: 26, status: "SUSPENDED" },
  { id: 1007, name: "Tom Becker", side: "R", parent: 1003, sponsor: 1003, pkg: "STARTER", daysAgo: 25 },
  // L3
  { id: 1008, name: "Aisha Diallo", side: "L", parent: 1004, sponsor: 1004, pkg: "GROWTH", daysAgo: 22 },
  { id: 1009, name: "Kenji Watanabe", side: "R", parent: 1004, sponsor: 1004, pkg: "STARTER", daysAgo: 21 },
  { id: 1010, name: "Elena Petrova", side: "L", parent: 1005, sponsor: 1005, pkg: "SCALE", daysAgo: 20 },
  { id: 1011, name: "Marcus Chen", side: "R", parent: 1005, sponsor: 1005, pkg: "GROWTH", daysAgo: 20 },
  { id: 1012, name: "Fatima Al-Rashid", side: "L", parent: 1006, sponsor: 1006, pkg: "STARTER", daysAgo: 19 },
  { id: 1013, name: "Oliver Bennett", side: "R", parent: 1006, sponsor: 1003, pkg: "GROWTH", daysAgo: 19 },
  { id: 1014, name: "Nadia Kovacs", side: "L", parent: 1007, sponsor: 1007, pkg: "STARTER", daysAgo: 18 },
  { id: 1015, name: "Samuel Adeyemi", side: "R", parent: 1007, sponsor: 1007, pkg: "GROWTH", daysAgo: 18 },
  // L4
  { id: 1016, name: "Grace Kim", side: "L", parent: 1008, sponsor: 1008, pkg: "STARTER", daysAgo: 16 },
  { id: 1017, name: "Lucas Moreau", side: "R", parent: 1008, sponsor: 1008, pkg: "GROWTH", daysAgo: 15 },
  { id: 1018, name: "Isabella Rossi", side: "L", parent: 1009, sponsor: 1009, pkg: "STARTER", daysAgo: 15 },
  { id: 1019, name: "Noah Fitzgerald", side: "R", parent: 1009, sponsor: 1009, pkg: "STARTER", daysAgo: 14 },
  { id: 1020, name: "Chloe Dubois", side: "L", parent: 1010, sponsor: 1007, pkg: "GROWTH", daysAgo: 13 },
  { id: 1021, name: "Raj Patel", side: "R", parent: 1010, sponsor: 1010, pkg: "STARTER", daysAgo: 13, status: "SUSPENDED" },
  { id: 1022, name: "Amara Haddad", side: "L", parent: 1011, sponsor: 1011, pkg: "GROWTH", daysAgo: 12 },
  { id: 1023, name: "Felix Wagner", side: "R", parent: 1011, sponsor: 1011, pkg: "STARTER", daysAgo: 12 },
  { id: 1024, name: "Zoe Sullivan", side: "L", parent: 1012, sponsor: 1012, pkg: "STARTER", daysAgo: 11 },
  { id: 1025, name: "Daniel Osei", side: "R", parent: 1012, sponsor: 1012, pkg: "GROWTH", daysAgo: 11 },
  { id: 1026, name: "Hannah Bergström", side: "L", parent: 1013, sponsor: 1013, pkg: "STARTER", daysAgo: 10 },
  { id: 1027, name: "Mateo Silva", side: "R", parent: 1013, sponsor: 1013, pkg: "STARTER", daysAgo: 10 },
  { id: 1028, name: "Lily Zhang", side: "L", parent: 1014, sponsor: 1014, pkg: "STARTER", daysAgo: 9 },
  { id: 1029, name: "Ethan Brooks", side: "R", parent: 1014, sponsor: 1014, pkg: "STARTER", daysAgo: 9 },
  { id: 1030, name: "Yara Mansour", side: "L", parent: 1015, sponsor: 1015, pkg: "GROWTH", daysAgo: 8 },
  { id: 1031, name: "Oliver Schmidt", side: "R", parent: 1015, sponsor: 1015, pkg: "STARTER", daysAgo: 8 },
  // L5 — left leg fills first (BFS reality), some spillover sponsors
  { id: 1032, name: "Ava Thompson", side: "L", parent: 1016, sponsor: 1016, pkg: "STARTER", daysAgo: 6 },
  { id: 1033, name: "Ryan Park", side: "R", parent: 1016, sponsor: 1004, pkg: "STARTER", daysAgo: 6 },
  { id: 1034, name: "Sofia Alvarez", side: "L", parent: 1017, sponsor: 1017, pkg: "GROWTH", daysAgo: 5 },
  { id: 1035, name: "Jonas Lindberg", side: "R", parent: 1017, sponsor: 1017, pkg: "STARTER", daysAgo: 5 },
  { id: 1036, name: "Mia Kowalski", side: "L", parent: 1018, sponsor: 1018, pkg: "STARTER", daysAgo: 4 },
  { id: 1037, name: "David Haddad", side: "R", parent: 1018, sponsor: 1018, pkg: "STARTER", daysAgo: 4 },
  { id: 1038, name: "Nina Larsen", side: "L", parent: 1019, sponsor: 1019, pkg: "STARTER", daysAgo: 4 },
  { id: 1039, name: "Omar Farouk", side: "R", parent: 1019, sponsor: 1008, pkg: "GROWTH", daysAgo: 3 },
  { id: 1040, name: "Emma Wilson", side: "L", parent: 1020, sponsor: 1020, pkg: "STARTER", daysAgo: 3 },
  { id: 1041, name: "Carlos Mendez", side: "R", parent: 1020, sponsor: 1020, pkg: "STARTER", daysAgo: 3 },
  { id: 1042, name: "Freya Johansson", side: "L", parent: 1022, sponsor: 1022, pkg: "STARTER", daysAgo: 2 },
  { id: 1043, name: "Andre Dubois", side: "R", parent: 1022, sponsor: 1011, pkg: "STARTER", daysAgo: 1, status: "GRACE" },
  { id: 1044, name: "Keiko Tanaka", side: "L", parent: 1024, sponsor: 1024, pkg: "STARTER", daysAgo: 1, status: "GRACE" },
  { id: 1045, name: "Leo Martins", side: "R", parent: 1024, sponsor: 1005, pkg: "STARTER", daysAgo: 0.2, status: "GRACE" },
];

/** Wipe and rebuild the 45-node demo network. Safe to call repeatedly. */
export async function seedNetwork(db: PrismaClient) {
  console.log("[portagraph] Resetting tables…");
  await db.earning.deleteMany();
  await db.event.deleteMany();
  await db.campaign.deleteMany();
  await db.user.deleteMany();

  console.log("[portagraph] Creating campaigns…");
  await db.campaign.createMany({
    data: [
      { id: "c-launch", name: "PortaGraph Launch", description: "Default on-chain opt-in. 12% compressed referral + 6% upline pool held 72h in SafetyHolding.", entryFee: 0, referralPct: 12, poolPct: 6, treasuryPct: 2, poolDepth: 5, active: true, optIns: 45, createdAt: new Date(NOW - 34 * DAY) },
      { id: "c-founders", name: "Founders Circle", description: "High-tier campaign with instant fee splits and deeper pool coverage for SCALE activations.", entryFee: 1500, referralPct: 15, poolPct: 5, treasuryPct: 2, poolDepth: 7, active: true, optIns: 8, createdAt: new Date(NOW - 30 * DAY) },
      { id: "c-q4", name: "Q4 Partner Sprint", description: "Time-boxed seasonal campaign. Boosted pool split, expires automatically at epoch end.", entryFee: 500, referralPct: 10, poolPct: 8, treasuryPct: 2, poolDepth: 5, active: true, optIns: 21, createdAt: new Date(NOW - 12 * DAY) },
    ],
  });

  console.log("[portagraph] Creating matrix nodes…");
  const users = rows.map((r) => ({
    id: r.id,
    name: r.name,
    handle: r.name.toLowerCase().replace(/[^a-z]+/g, "."),
    wallet: wallet(r.id),
    email: r.email ?? `${r.name.toLowerCase().replace(/[^a-z]+/g, ".")}@portagraph.io`,
    provider: r.founder ? "demo" : (["email", "google", "x"] as const)[Math.floor(rnd() * 3)],
    avatarSeed: r.name,
    side: r.side,
    parentId: r.parent,
    depth: 0,
    sponsorId: r.sponsor,
    status: r.status ?? "ACTIVE",
    package: r.pkg,
    pkgAmount: PKG[r.pkg],
    isFounder: !!r.founder,
    joinedAt: new Date(NOW - r.daysAgo * DAY),
    activatedAt: new Date(NOW - r.daysAgo * DAY + 3600_000),
  }));
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const u of users) {
    let d = 0, p = u.parentId;
    while (p) { d++; p = byId.get(p)!.parentId; }
    u.depth = d;
  }
  await db.user.createMany({ data: users });

  // ── volumes (what the Indexer recomputes on every Registry event) ──
  const childrenOf = new Map<number, number[]>();
  for (const u of users) {
    if (u.parentId == null) continue;
    childrenOf.set(u.parentId, [...(childrenOf.get(u.parentId) ?? []), u.id]);
  }
  const subtreeVol = (id: number): number =>
    (childrenOf.get(id) ?? []).reduce((s, c) => s + subtreeVol(c), byId.get(id)!.pkgAmount);

  console.log("[portagraph] Seeding earnings & events…");
  let block = 4_821_300;
  const events: { type: string; txHash: string; blockNumber: number; actorId: number | null; actorName: string; headline: string; detail: string; amount: number | null; createdAt: Date }[] = [];
  const earnings: { userId: number; kind: string; amount: number; fromId: number | null; fromName: string | null; status: string; heldUntil: Date | null; campaignId: string | null; note: string | null; createdAt: Date }[] = [];
  let tx = 0;

  const CAP = { STARTER: 1_000, GROWTH: 4_000, SCALE: 15_000 };
  for (const r of rows) {
    const u = byId.get(r.id)!;
    const kids = childrenOf.get(r.id) ?? [];
    const L = kids[0] ? subtreeVol(kids[0]) : 0, R = kids[1] ? subtreeVol(kids[1]) : 0;

    // referral earnings on each direct child's activation
    for (const kid of kids) {
      const k = byId.get(kid)!;
      earnings.push({
        userId: r.id, kind: "REFERRAL", amount: +(k.pkgAmount * 0.12).toFixed(2),
        fromId: kid, fromName: k.name, status: "RELEASED",
        campaignId: k.pkgAmount >= 1500 ? "c-founders" : "c-launch",
        note: `12% compressed referral · ${k.name} activated ${k.package}`,
        createdAt: new Date(new Date(k.joinedAt).getTime() + 3600_000),
      });
      events.push({
        type: "FEE_SPLIT", txHash: txHash(tx++), blockNumber: block += 11 + Math.floor(rnd() * 40),
        actorId: kid, actorName: k.name,
        headline: `Fee split on #${kid} activation — ${u.name} received ${(k.pkgAmount * 0.12).toFixed(0)} USDT`,
        detail: JSON.stringify({ splits: [{ to: r.id, usdt: +(k.pkgAmount * 0.12).toFixed(2), kind: "REFERRAL" }] }),
        amount: +(k.pkgAmount * 0.12).toFixed(2), createdAt: new Date(new Date(k.joinedAt).getTime() + 3660_000),
      });
    }

    // weekly matching bonus = 10% of weaker leg, capped by tier (3 past cycles)
    const base = Math.min(L, R);
    if (base > 0) {
      for (let w = 0; w < 3; w++) {
        const ramp = 0.45 + 0.25 * w + rnd() * 0.1;
        const amt = Math.min(base * 0.10 * ramp, CAP[r.pkg]);
        if (amt < 1) continue;
        const ageDays = 21 - w * 7;
        const createdAt = new Date(NOW - ageDays * DAY);
        const isHeld = ageDays < 3;
        earnings.push({
          userId: r.id, kind: "MATCHING", amount: +amt.toFixed(2),
          status: isHeld ? "HELD" : "RELEASED",
          heldUntil: isHeld ? new Date(NOW + (3 - ageDays) * DAY) : null,
          campaignId: "c-launch", note: `Weekly binary match · weak leg ${Math.round(base).toLocaleString()} USDT`,
          createdAt,
        });
        if (r.id === 1001 || r.id === 1002 || r.id === 1003) {
          events.push({
            type: "HOLD_RELEASE", txHash: txHash(tx++), blockNumber: block += 9 + Math.floor(rnd() * 30),
            actorId: r.id, actorName: r.name,
            headline: `SafetyHolding released ${amt.toFixed(0)} USDT matching bonus to #${r.id}`,
            detail: JSON.stringify({ cycle: `W${21 - ageDays / 7}`, weakLeg: Math.round(base) }),
            amount: +amt.toFixed(2), createdAt,
          });
        }
      }
    }

    events.push({
      type: "JOIN", txHash: txHash(tx++), blockNumber: block += 5 + Math.floor(rnd() * 25),
      actorId: r.id, actorName: r.name,
      headline: r.id === 1001 ? "Genesis node #1001 minted — SBT bound to Alex Carter" : `${r.name} activated #${r.id} · ${r.pkg} package${r.sponsor !== r.parent ? " (BFS spillover placement)" : ""}`,
      detail: JSON.stringify({ position: r.id, parent: r.parent, side: r.side, sponsor: r.sponsor, pkg: r.pkg, spillover: r.sponsor !== r.parent }),
      amount: PKG[r.pkg], createdAt: u.joinedAt,
    });
  }

  // compression demo events
  events.push(
    { type: "COMPRESSION", txHash: txHash(tx++), blockNumber: block += 17, actorId: 1006, actorName: "Priya Natarajan", headline: "Upline #1006 suspended — future splits compress to #1003", detail: JSON.stringify({ skipped: [1006], beneficiaries: [1003, 1001] }), createdAt: new Date(NOW - 2 * DAY) },
    { type: "COMPRESSION", txHash: txHash(tx++), blockNumber: block += 23, actorId: 1021, actorName: "Raj Patel", headline: "Upline #1021 suspended — fee pool compresses through #1010 → #1005", detail: JSON.stringify({ skipped: [1021], beneficiaries: [1010, 1005, 1002, 1001] }), createdAt: new Date(NOW - 1.5 * DAY) },
  );

  await db.earning.createMany({ data: earnings });
  await db.event.createMany({ data: events });

  // ── roll up totals on users ──
  console.log("[portagraph] Rolling up user totals…");
  for (const r of rows) {
    const mine = earnings.filter((e) => e.userId === r.id);
    const released = mine.filter((e) => e.status === "RELEASED").reduce((s, e) => s + e.amount, 0);
    const held = mine.filter((e) => e.status === "HELD").reduce((s, e) => s + e.amount, 0);
    const kids = childrenOf.get(r.id) ?? [];
    const L = kids[0] ? subtreeVol(kids[0]) : 0, R = kids[1] ? subtreeVol(kids[1]) : 0;
    await db.user.update({
      where: { id: r.id },
      data: { leftVol: L, rightVol: R, totalEarned: +(released + held).toFixed(2), heldAmount: +held.toFixed(2) },
    });
  }

  console.log(`[portagraph] ✓ Seeded ${rows.length} nodes · ${earnings.length} earnings · ${events.length} events · 3 campaigns`);
}
