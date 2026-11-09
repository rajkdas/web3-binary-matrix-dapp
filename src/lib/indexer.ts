// ─────────────────────────────────────────────────────────────────────────────
// PortaGraph Indexer core — the off-chain twin of the on-chain Registry.
//
// The Registry contract stores immutable (parent, side) bindings and emits
// events. This module mirrors that state in memory, then answers the
// expensive questions off-chain so the contracts never pay gas for search:
//
//   • findBFSPlacement()  — breadth-first search for the first open slot
//   • compressedUpline()  — skips suspended/grace nodes when routing splits
//   • computeFeeSplits()  — campaign-aware instant fee split schedule
//   • recomputeVolumes()  — left/right subtree volume rollup
//   • gasModel()          — on-chain BFS vs off-chain sync cost model
// ─────────────────────────────────────────────────────────────────────────────

export type Side = "L" | "R";
export type NodeStatus = "ACTIVE" | "GRACE" | "SUSPENDED";
export type PackageTier = "STARTER" | "GROWTH" | "SCALE";

export interface MatrixUser {
  id: number;
  name: string;
  handle: string;
  wallet: string;
  email: string | null;
  provider: string;
  avatarSeed: string;
  side: Side | null;
  parentId: number | null;
  depth: number;
  sponsorId: number | null;
  status: NodeStatus;
  package: PackageTier;
  pkgAmount: number;
  isFounder: boolean;
  leftVol: number;
  rightVol: number;
  totalEarned: number;
  heldAmount: number;
  joinedAt: string;
  activatedAt: string;
}

export interface SplitLine {
  toId: number;
  toName: string;
  kind: "REFERRAL" | "POOL" | "TREASURY";
  usdt: number;
  held: boolean;
  note: string;
}

export interface PlacementResult {
  parentId: number;
  parentName: string;
  side: Side;
  visited: number[]; // BFS traversal order (for the animation)
  spillover: boolean; // sponsor ≠ placement parent
  queueSnapshots: { step: number; dequeued: number; queue: number[] }[];
}

export const PKG_PRICE: Record<PackageTier, number> = { STARTER: 100, GROWTH: 500, SCALE: 1500 };
export const PKG_CAP: Record<PackageTier, number> = { STARTER: 1_000, GROWTH: 4_000, SCALE: 15_000 };
export const GRACE_HOURS = 72;

export function childrenMap(users: MatrixUser[]) {
  const m = new Map<number, number[]>();
  for (const u of users) {
    if (u.parentId == null) continue;
    const arr = m.get(u.parentId) ?? [];
    arr.push(u.id);
    m.set(u.parentId, arr);
  }
  return m;
}

export function userMap(users: MatrixUser[]) {
  return new Map(users.map((u) => [u.id, u]));
}

/** Recompute left/right subtree volumes — cheap off-chain, expensive on-chain. */
export function recomputeVolumes(users: MatrixUser[]) {
  const kids = childrenMap(users);
  const byId = userMap(users);
  const vol = (id: number): number => {
    const u = byId.get(id);
    if (!u) return 0;
    const [l, r] = kids.get(id) ?? [];
    return vol(l ?? -1) + vol(r ?? -1) + u.pkgAmount;
  };
  const out = new Map<number, { leftVol: number; rightVol: number }>();
  for (const u of users) {
    const [l, r] = kids.get(u.id) ?? [];
    out.set(u.id, { leftVol: l ? vol(l) : 0, rightVol: r ? vol(r) : 0 });
  }
  return out;
}

/**
 * Breadth-first forced placement — identical semantics to
 * Registry.findPlacement() in Solidity, executed off-chain for ~0 marginal cost.
 * BFS from `sponsorId`; the first node with a free L/R slot wins (spillover).
 */
export function findBFSPlacement(
  users: MatrixUser[],
  sponsorId: number,
  preferSide?: Side
): PlacementResult | null {
  const byId = userMap(users);
  const kids = childrenMap(users);
  const root = byId.get(sponsorId);
  if (!root) return null;

  const queue: number[] = [sponsorId];
  const visited: number[] = [];
  const queueSnapshots: PlacementResult["queueSnapshots"] = [];

  // preferred side is honored only at the sponsor's own node
  if (preferSide) {
    const existing = kids.get(sponsorId) ?? [];
    const occupied = new Set(existing.map((c) => byId.get(c)!.side));
    if (!occupied.has(preferSide)) {
      return {
        parentId: sponsorId,
        parentName: root.name,
        side: preferSide,
        visited: [sponsorId],
        spillover: false,
        queueSnapshots: [{ step: 1, dequeued: sponsorId, queue: [] }],
      };
    }
  }

  let step = 0;
  while (queue.length > 0 && visited.length < 4096) {
    const cur = queue.shift()!;
    visited.push(cur);
    const curNode = byId.get(cur);
    if (!curNode) continue;

    const children = kids.get(cur) ?? [];
    const has = (s: Side) => children.some((c) => byId.get(c)!.side === s);
    if (children.length < 2) {
      const side: Side = !has("L") ? "L" : "R";
      queueSnapshots.push({ step: ++step, dequeued: cur, queue: [...queue] });
      return {
        parentId: cur,
        parentName: curNode.name,
        side,
        visited,
        spillover: cur !== sponsorId,
        queueSnapshots,
      };
    }
    queueSnapshots.push({ step: ++step, dequeued: cur, queue: [...queue] });
    for (const c of children) queue.push(c);
  }
  return null;
}

/**
 * Compressed upline walk — mirrors Campaign.compressedUpline() in Solidity.
 * Skips SUSPENDED (and optionally GRACE) ancestors and returns the first
 * `depth` eligible beneficiaries with the skipped hop count for UX.
 */
export function compressedUpline(
  users: MatrixUser[],
  fromId: number,
  depth: number,
  skipGrace = false
) {
  const byId = userMap(users);
  const chain: { id: number; name: string; status: NodeStatus }[] = [];
  const skipped: number[] = [];
  let cur = byId.get(fromId)?.parentId ?? null;
  while (cur != null && chain.length < depth) {
    const node = byId.get(cur);
    if (!node) break;
    if (node.status === "SUSPENDED" || (skipGrace && node.status === "GRACE")) {
      skipped.push(node.id);
    } else {
      chain.push({ id: node.id, name: node.name, status: node.status });
    }
    cur = node.parentId;
  }
  return { beneficiaries: chain, skipped };
}

/** Full vertical ancestry (no skipping) — used by the compression visualizer. */
export function ancestryChain(users: MatrixUser[], fromId: number) {
  const byId = userMap(users);
  const chain: { id: number; name: string; status: NodeStatus }[] = [];
  let cur = byId.get(fromId)?.parentId ?? null;
  while (cur != null) {
    const node = byId.get(cur);
    if (!node) break;
    chain.push({ id: node.id, name: node.name, status: node.status });
    cur = node.parentId;
  }
  return chain;
}

export interface CampaignConfig {
  id: string;
  name: string;
  entryFee: number;
  referralPct: number;
  poolPct: number;
  treasuryPct: number;
  poolDepth: number;
  active: boolean;
}

/**
 * Instant fee-split schedule — mirrors Campaign.splitFee() semantics.
 * Referral leg compresses over inactive ancestors; pool leg is held in
 * SafetyHolding for the grace window; treasury is immediate.
 */
export function computeFeeSplits(
  users: MatrixUser[],
  campaign: CampaignConfig,
  pkgAmount: number,
  sponsorId: number | null,
  placementParentId: number
): SplitLine[] {
  const byId = userMap(users);
  const lines: SplitLine[] = [];
  const gross = campaign.entryFee > 0 ? campaign.entryFee : pkgAmount;

  // 1) compressed referral — walk up from the SPONSOR until an ACTIVE node pays
  const referralTotal = +(gross * (campaign.referralPct / 100)).toFixed(2);
  if (sponsorId != null) {
    const { beneficiaries } = compressedUpline(users, sponsorId, 1);
    const payee = beneficiaries[0];
    if (payee) {
      lines.push({
        toId: payee.id,
        toName: payee.name,
        kind: "REFERRAL",
        usdt: referralTotal,
        held: false,
        note: `Compressed referral ${campaign.referralPct}% (sponsor leg)`,
      });
    }
  }

  // 2) upline pool — next `poolDepth` active ancestors of the PLACEMENT parent
  const poolTotal = +(gross * (campaign.poolPct / 100)).toFixed(2);
  const { beneficiaries: pool } = compressedUpline(users, placementParentId, campaign.poolDepth);
  if (pool.length > 0) {
    const per = +(poolTotal / pool.length).toFixed(2);
    pool.forEach((p, i) => {
      lines.push({
        toId: p.id,
        toName: p.name,
        kind: "POOL",
        usdt: i === 0 ? +(poolTotal - per * (pool.length - 1)).toFixed(2) : per,
        held: true,
        note: `Upline pool ${campaign.poolPct}% / depth ${campaign.poolDepth} — held ${GRACE_HOURS}h`,
      });
    });
  }

  // 3) treasury — immediate
  lines.push({
    toId: 0,
    toName: "Protocol Treasury",
    kind: "TREASURY",
    usdt: +(gross * (campaign.treasuryPct / 100)).toFixed(2),
    held: false,
    note: `Treasury ${campaign.treasuryPct}%`,
  });

  return lines;
}

// ─── Gas cost model (stated assumptions, computed — not hand-waved) ─────────
export interface GasAssumptions {
  ethPrice: number; // USD
  baseGwei: number; // typical Base gas price
  gasPerStorageSlot: number;
  gasPerLoopIteration: number;
  baseTxOverhead: number;
}

export const DEFAULT_GAS: GasAssumptions = {
  ethPrice: 3200,
  baseGwei: 0.05,
  gasPerStorageSlot: 2100,
  gasPerLoopIteration: 2600,
  baseTxOverhead: 21000,
};

/**
 * Placement cost at network size N:
 *  On-chain BFS  → the EVM must walk ~N/2 nodes inside findPlacement(),
 *                   each iteration ≈ 1 SLOAD + loop overhead, plus 2 SSTOREs.
 *  PortaGraph    → indexer answers placement off-chain; the chain only stores
 *                   the final binding: fixed ~63k gas regardless of N.
 */
export function placementGas(N: number, a: GasAssumptions = DEFAULT_GAS) {
  const iterations = Math.ceil(N / 2);
  const onChain =
    a.baseTxOverhead + iterations * a.gasPerLoopIteration + 2 * a.gasPerStorageSlot;
  const offchain = a.baseTxOverhead + 3 * a.gasPerStorageSlot; // store parent, side, sbt
  const usd = (g: number) => (g * a.baseGwei * 1e-9) * a.ethPrice;
  return {
    N,
    onChainGas: Math.round(onChain),
    offChainGas: Math.round(offchain),
    onChainUsd: +usd(onChain).toFixed(4),
    offChainUsd: +usd(offchain).toFixed(4),
    savingPct: +(((onChain - offchain) / onChain) * 100).toFixed(1),
  };
}

// ─── formatting helpers shared across UI ─────────────────────────────────────
export const fmtUSD = (n: number, digits = 0) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const fmtMoney = fmtUSD;

export const fmtCompact = (n: number) =>
  Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function pseudoTxHash(seed: number) {
  let h = "0x";
  let x = seed * 2654435761;
  for (let i = 0; i < 64; i++) {
    x = (x ^ (x << 13)) >>> 0; x = (x ^ (x >>> 17)) >>> 0; x = (x ^ (x << 5)) >>> 0;
    h += (x % 16).toString(16);
  }
  return h;
}
