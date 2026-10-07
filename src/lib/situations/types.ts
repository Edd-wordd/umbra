import type { BrainNode, BrainStatus } from "../brain/types";

export type SituationType =
  | "blocked_agent"
  | "failed_ci"
  | "stale_port"
  | "dirty_repo"
  | "local_only_work"
  | "service_attention";

export type SituationLifecycle = "new" | "active" | "waiting" | "snoozed" | "resolved" | "ignored" | "recurring";

export interface SituationActionRef {
  id: string;
  label: string;
  risk?: string;
}

export interface Situation {
  id: string;
  type: SituationType;
  sourceTypes?: SituationType[];
  title: string;
  status: SituationLifecycle;
  severity: BrainStatus;
  confidence: number;
  entities: string[];
  signals: string[];
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
  summary: string;
  whyNow: string;
  suggestedActions: SituationActionRef[];
  needsHuman: boolean;
}

export interface SituationInput {
  nodes: BrainNode[];
  now?: number;
}
