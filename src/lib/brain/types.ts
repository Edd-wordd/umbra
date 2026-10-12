export const BRAIN_DOMAINS = [
  "dev",
  "lab",
  "print",
  "astro",
  "business",
  "cameras",
  "knowledge",
  "ops",
] as const;

export type BrainDomain = (typeof BRAIN_DOMAINS)[number];

export type BrainStatus =
  | "silent"
  | "fyi"
  | "watch"
  | "actionable"
  | "judgment"
  | "approval"
  | "blocked"
  | "critical";

export type BrainRisk =
  | "read"
  | "prepare"
  | "local-safe"
  | "local-risky"
  | "external"
  | "destructive"
  | "physical"
  | "financial"
  | "security";

export type BrainNodeType =
  | "project"
  | "repo"
  | "service"
  | "device"
  | "agent"
  | "session"
  | "process"
  | "job"
  | "runbook"
  | "decision"
  | "incident"
  | "action"
  | "approval"
  | "memory_event"
  | "note"
  | "person"
  | "lead"
  | "environment";

export type BrainEdgeType =
  | "owns"
  | "contains"
  | "runs"
  | "runs_on"
  | "depends_on"
  | "documents"
  | "uses"
  | "triggered"
  | "resolved_by"
  | "blocked_by"
  | "affects"
  | "belongs_to"
  | "related_to"
  | "derived_from"
  | "assigned_to"
  | "observed_in"
  | "targets"
  | "hosts";

export interface BrainNode {
  id: string;
  type: BrainNodeType;
  label: string;
  domain: BrainDomain;
  status?: BrainStatus;
  source?: string;
  updatedAt?: number;
  meta?: Record<string, string | number | boolean | null | undefined>;
}

export interface BrainEdge {
  id?: string;
  from: string;
  to: string;
  type: BrainEdgeType;
  label?: string;
  weight?: number;
  source?: string;
  updatedAt?: number;
  meta?: Record<string, string | number | boolean | null | undefined>;
}

export interface BrainGraph {
  nodes: BrainNode[];
  edges: BrainEdge[];
}

export interface GraphTraversalOptions {
  depth?: number;
  edgeTypes?: readonly BrainEdgeType[];
  direction?: "out" | "in" | "both";
}

export interface GraphPathOptions {
  maxDepth?: number;
  edgeTypes?: readonly BrainEdgeType[];
  direction?: "out" | "in" | "both";
}

export interface GraphPath {
  nodes: BrainNode[];
  edges: BrainEdge[];
}
