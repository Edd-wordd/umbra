import type { DevSnapshot } from "../dev/types";
import { memoryFromBrainSnapshot, memoryFromSituation, type MemoryEvent } from "../memory";
import { deriveDevSituations } from "../situations/dev";
import type { Situation } from "../situations/types";
import { devSnapshotToBrainGraph } from "./dev-adapter";
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
  const graph = devSnapshotToBrainGraph(dev, now);
  const snapshot = createBrainSnapshot(graph, "dev", now);
  const situations = deriveDevSituations(graph, now);
  const memory = [memoryFromBrainSnapshot(snapshot), ...situations.map((situation) => memoryFromSituation(situation, now))];
  return {
    graph,
    snapshot,
    situations,
    attention: attentionNodes(graph),
    domains: domainSummary(graph),
    memory,
  };
}
