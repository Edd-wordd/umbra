import type { DevSnapshot } from "../dev/types";
import { DEV_DOMAIN_ADAPTER, buildDomainPipeline } from "../domain";
import type { MemoryEvent } from "../memory";
import type { Situation } from "../situations/types";
import { attentionNodes, domainSummary } from "./queries";
import { createBrainSnapshot, type BrainSnapshot } from "./snapshot";
import type { BrainGraph, BrainNode } from "./types";

export interface BrainPipelineResult {
  graph: BrainGraph;
  snapshot: BrainSnapshot;
  situations: Situation[];
  attention: BrainNode[];
  domains: Record<string, { total: number; attention: number; critical: number }>;
  memory: MemoryEvent[];
}

export function buildBrainFromDevSnapshot(dev: DevSnapshot, now = Date.now()): BrainPipelineResult {
  const domain = buildDomainPipeline(DEV_DOMAIN_ADAPTER, dev, now);
  const graph = domain.graph;
  const snapshot = createBrainSnapshot(graph, "dev", now);
  const situations = domain.situations;
  const memory = domain.memory;
  return {
    graph,
    snapshot,
    situations,
    attention: attentionNodes(graph),
    domains: domainSummary(graph),
    memory,
  };
}
