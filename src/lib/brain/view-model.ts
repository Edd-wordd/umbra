import type { MultiDomainPipelineResult } from "../domain/multi";
import type { Situation } from "../situations/types";
import { BRAIN_DOMAINS, type BrainDomain, type BrainStatus } from "./types";

export interface BrainSectorView {
  domain: BrainDomain;
  status: BrainStatus;
  total: number;
  attention: number;
  critical: number;
  situations: Situation[];
}

export interface BrainViewModel {
  sectors: BrainSectorView[];
  totals: {
    nodes: number;
    edges: number;
    situations: number;
    approvals: number;
    attention: number;
  };
}

const STATUS_RANK: Record<BrainStatus, number> = {
  silent: 0,
  fyi: 1,
  watch: 2,
  actionable: 3,
  judgment: 4,
  approval: 5,
  blocked: 6,
  critical: 7,
};

export function buildBrainViewModel(result: MultiDomainPipelineResult): BrainViewModel {
  const sectors = BRAIN_DOMAINS.map((domain) => {
    const nodes = result.graph.nodes.filter((node) => node.domain === domain);
    const situations = result.situations.filter((situation) => nodes.some((node) => situation.entities.includes(node.id)));
    const nodeStatuses = nodes.map((node) => node.status ?? "silent");
    const situationStatuses = situations.map((situation) => situation.severity);
    const status = highestStatus([...nodeStatuses, ...situationStatuses]);
    return {
      domain,
      status,
      total: nodes.length,
      attention: nodes.filter((node) => node.status && !["silent", "fyi"].includes(node.status)).length,
      critical: nodes.filter((node) => node.status === "critical" || node.status === "blocked").length,
      situations,
    } satisfies BrainSectorView;
  });

  return {
    sectors,
    totals: {
      nodes: result.graph.nodes.length,
      edges: result.graph.edges.length,
      situations: result.situations.length,
      approvals: result.graph.nodes.filter((node) => node.status === "approval").length,
      attention: result.attention.length,
    },
  };
}

function highestStatus(statuses: BrainStatus[]): BrainStatus {
  return statuses.reduce<BrainStatus>((best, status) => (STATUS_RANK[status] > STATUS_RANK[best] ? status : best), "silent");
}
