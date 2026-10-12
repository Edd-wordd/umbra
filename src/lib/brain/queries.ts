import { neighbors, relatedEdges, shortestPath } from "./graph";
import type { BrainEdgeType, BrainGraph, BrainNode, GraphPath } from "./types";

export interface RelatedQuery {
  edgeTypes?: readonly BrainEdgeType[];
  depth?: number;
  direction?: "out" | "in" | "both";
  nodeTypes?: readonly BrainNode["type"][];
}

export function related(graph: BrainGraph, entityId: string, query: RelatedQuery = {}): BrainNode[] {
  const found = neighbors(graph, entityId, {
    depth: query.depth ?? 1,
    edgeTypes: query.edgeTypes,
    direction: query.direction ?? "both",
  });
  return query.nodeTypes ? found.filter((node) => query.nodeTypes?.includes(node.type)) : found;
}

export function runbooksForEntity(graph: BrainGraph, entityId: string, depth = 2): BrainNode[] {
  return related(graph, entityId, { depth, nodeTypes: ["runbook"], edgeTypes: ["uses", "documents", "related_to"] });
}

export function decisionsAffectingEntity(graph: BrainGraph, entityId: string, depth = 3): BrainNode[] {
  return related(graph, entityId, { depth, nodeTypes: ["decision"], edgeTypes: ["affects", "documents", "related_to", "derived_from"] });
}

export function incidentsForEntity(graph: BrainGraph, entityId: string, depth = 2): BrainNode[] {
  return related(graph, entityId, { depth, nodeTypes: ["incident"], edgeTypes: ["affects", "triggered", "related_to", "derived_from"] });
}

export function actionsForEntity(graph: BrainGraph, entityId: string, depth = 2): BrainNode[] {
  return related(graph, entityId, { depth, nodeTypes: ["action"], edgeTypes: ["resolved_by", "blocked_by", "related_to", "uses"] });
}

export function pathBetween(graph: BrainGraph, from: string, to: string, maxDepth = 4): GraphPath | undefined {
  return shortestPath(graph, from, to, { maxDepth, direction: "both" });
}

export function attentionNodes(graph: BrainGraph): BrainNode[] {
  return graph.nodes.filter((node) => node.status && !["silent", "fyi"].includes(node.status));
}

export function domainSummary(graph: BrainGraph): Record<string, { total: number; attention: number; critical: number }> {
  const summary: Record<string, { total: number; attention: number; critical: number }> = {};
  for (const node of graph.nodes) {
    summary[node.domain] ??= { total: 0, attention: 0, critical: 0 };
    summary[node.domain].total += 1;
    if (node.status && !["silent", "fyi"].includes(node.status)) summary[node.domain].attention += 1;
    if (node.status === "critical") summary[node.domain].critical += 1;
  }
  return summary;
}

export function explainNeighborhood(graph: BrainGraph, entityId: string, depth = 1): string[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const lines: string[] = [];
  for (const node of related(graph, entityId, { depth })) {
    const edges = relatedEdges(graph, node.id, "both").filter((edge) => edge.from === entityId || edge.to === entityId);
    for (const edge of edges) {
      const from = nodeById.get(edge.from)?.label ?? edge.from;
      const to = nodeById.get(edge.to)?.label ?? edge.to;
      lines.push(`${from} --${edge.type}--> ${to}`);
    }
  }
  return [...new Set(lines)];
}
