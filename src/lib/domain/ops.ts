import type { BrainGraph, BrainNode } from "../brain/types";
import type { Situation } from "../situations/types";
import type { DomainAdapter } from "./types";

export interface OpsSnapshot {
  pendingApprovals: number;
  preparedActions: number;
  openLoops: number;
  whatChangedReady: boolean;
}

export const OPS_DOMAIN_ADAPTER: DomainAdapter<OpsSnapshot> = {
  id: "ops",
  label: "Ops",
  toGraph: opsSnapshotToGraph,
  deriveSituations: deriveOpsSituations,
};

export function createSampleOpsSnapshot(): OpsSnapshot {
  return { pendingApprovals: 3, preparedActions: 5, openLoops: 7, whatChangedReady: true };
}

function opsSnapshotToGraph(snapshot: OpsSnapshot, now: number): BrainGraph {
  const nodes: BrainNode[] = [
    {
      id: "ops:approvals",
      type: "approval",
      label: "Pending approvals",
      domain: "ops",
      status: snapshot.pendingApprovals > 0 ? "approval" : "silent",
      source: "ops",
      updatedAt: now,
      meta: { count: snapshot.pendingApprovals },
    },
    {
      id: "ops:prepared-actions",
      type: "action",
      label: "Prepared actions",
      domain: "ops",
      status: snapshot.preparedActions > 0 ? "watch" : "silent",
      source: "ops",
      updatedAt: now,
      meta: { count: snapshot.preparedActions },
    },
    {
      id: "ops:open-loops",
      type: "incident",
      label: "Open loops",
      domain: "ops",
      status: snapshot.openLoops > 0 ? "watch" : "silent",
      source: "ops",
      updatedAt: now,
      meta: { count: snapshot.openLoops },
    },
  ];
  return { nodes, edges: [] };
}

function deriveOpsSituations(graph: BrainGraph, _snapshot: OpsSnapshot, now: number): Situation[] {
  const approvals = graph.nodes.find((node) => node.id === "ops:approvals" && node.status === "approval");
  if (!approvals) return [];
  return [
    {
      id: "situation:ops:approvals",
      type: "approval_waiting",
      title: "Approvals waiting",
      status: "active",
      severity: "approval",
      confidence: 0.9,
      entities: [approvals.id],
      signals: [],
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      summary: `${approvals.meta?.count ?? 0} approvals waiting`,
      whyNow: "one or more prepared actions require Edward's explicit approval",
      suggestedActions: [
        { id: "ops.approvals.review", label: "Review approvals", risk: "read" },
        { id: "ops.whatChanged.show", label: "Show what changed", risk: "read" },
      ],
      needsHuman: true,
    },
  ];
}
