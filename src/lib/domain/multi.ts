import { createGraph, upsertEdges, upsertNodes } from "../brain/graph";
import { attentionNodes, domainSummary } from "../brain/queries";
import { createBrainSnapshot, type BrainSnapshot } from "../brain/snapshot";
import type { BrainGraph, BrainNode } from "../brain/types";
import type { MemoryEvent } from "../memory/types";
import type { Situation } from "../situations/types";
import { buildDomainPipeline } from "./pipeline";
import type { DomainAdapter, DomainPipelineResult } from "./types";

export interface DomainPipelineInput<TSnapshot = unknown> {
  adapter: DomainAdapter<TSnapshot>;
  snapshot: TSnapshot;
}

export type AnyDomainPipelineInput = {
  adapter: DomainAdapter<never>;
  snapshot: unknown;
};

export interface MultiDomainPipelineResult {
  graph: BrainGraph;
  snapshot: BrainSnapshot;
  situations: Situation[];
  memory: MemoryEvent[];
  attention: BrainNode[];
  domains: Record<string, { total: number; attention: number; critical: number }>;
  adapterResults: DomainPipelineResult[];
}

export function buildMultiDomainPipeline(inputs: readonly AnyDomainPipelineInput[], now = Date.now()): MultiDomainPipelineResult {
  const adapterResults = inputs.map((input) => buildDomainPipeline(input.adapter as DomainAdapter<unknown>, input.snapshot, now));
  const graph = adapterResults.reduce((acc, result) => mergeGraphs(acc, result.graph), createGraph());
  const situations = adapterResults.flatMap((result) => result.situations);
  const memory = adapterResults.flatMap((result) => result.memory);
  const snapshot = createBrainSnapshot(graph, "multi-domain", now);
  return {
    graph,
    snapshot,
    situations,
    memory,
    attention: attentionNodes(graph),
    domains: domainSummary(graph),
    adapterResults,
  };
}

function mergeGraphs(a: BrainGraph, b: BrainGraph): BrainGraph {
  return createGraph(upsertNodes(a.nodes, b.nodes), upsertEdges(a.edges, b.edges));
}
