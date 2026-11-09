// Shared DTOs between the API layer and the dashboard client.
import type { MatrixUser, SplitLine, PlacementResult } from "@/lib/indexer";

export interface ChainEventDTO {
  id: string;
  type: string;
  txHash: string;
  blockNumber: number;
  actorId: number | null;
  actorName: string;
  headline: string;
  detail: string | null;
  amount: number | null;
  createdAt: string;
}

export interface EarningDTO {
  id: string;
  userId: number;
  kind: string;
  amount: number;
  fromId: number | null;
  fromName: string | null;
  status: "HELD" | "RELEASED" | "REVERSED";
  heldUntil: string | null;
  campaignId: string | null;
  note: string | null;
  createdAt: string;
}

export interface CampaignDTO {
  id: string;
  name: string;
  description: string;
  entryFee: number;
  referralPct: number;
  poolPct: number;
  treasuryPct: number;
  poolDepth: number;
  active: boolean;
  optIns: number;
  createdAt: string;
}

export interface NetworkSnapshot {
  users: MatrixUser[];
  events: ChainEventDTO[];
  earnings: EarningDTO[];
  campaigns: CampaignDTO[];
  meta: {
    chainId: number;
    chain: string;
    registry: string;
    lastIndexedBlock: number;
    indexerLagMs: number;
    generatedAt: string;
  };
}

export interface JoinResponse {
  user: MatrixUser;
  placement: PlacementResult;
  splits: (SplitLine & { toId: number })[];
  campaignId: string;
  txHash: string;
  blockNumber: number;
}

export type { MatrixUser, SplitLine, PlacementResult };
