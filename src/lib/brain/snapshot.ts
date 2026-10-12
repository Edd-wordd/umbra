import { createGraph, upsertEdges, upsertNodes } from "./graph";
import type { BrainEdge, BrainGraph, BrainNode } from "./types";

export interface BrainSnapshot {
  id: string;
  at: number;
  graph: BrainGraph;
  source?: string;
}

let seq = 0;

export function createBrainSnapshot(graph: BrainGraph, source?: string, at = Date.now()): BrainSnapshot {
  seq += 1;
  return { id: `brain-snapshot-${at}-${seq.toString(36)}`, at, graph, source };
}

export function mergeGraph(base: BrainGraph, patch: Partial<BrainGraph>): BrainGraph {
  return createGraph(upsertNodes(base.nodes, patch.nodes ?? []), upsertEdges(base.edges, patch.edges ?? []));
}

export function graphPatch(nodes: BrainNode[] = [], edges: BrainEdge[] = []): BrainGraph {
  return createGraph(nodes, edges);
}

export function diffSnapshots(before: BrainSnapshot, after: BrainSnapshot) {
  const beforeNodes = new Map(before.graph.nodes.map((node) => [node.id, node]));
  const afterNodes = new Map(after.graph.nodes.map((node) => [node.id, node]));
  const addedNodes = after.graph.nodes.filter((node) => !beforeNodes.has(node.id));
  const removedNodes = before.graph.nodes.filter((node) => !afterNodes.has(node.id));
  const changedNodes = after.graph.nodes.filter((node) => {
    const prev = beforeNodes.get(node.id);
    return prev && JSON.stringify(prev) !== JSON.stringify(node);
  });
  return { addedNodes, removedNodes, changedNodes };
}
