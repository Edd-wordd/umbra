import { memoryFromBrainSnapshot, memoryFromSituation } from "../memory";
import { createBrainSnapshot } from "../brain/snapshot";
import type { DomainAdapter, DomainPipelineResult } from "./types";

export function buildDomainPipeline<TSnapshot>(adapter: DomainAdapter<TSnapshot>, snapshot: TSnapshot, now = Date.now()): DomainPipelineResult<TSnapshot> {
  const graph = adapter.toGraph(snapshot, now);
  const situations = adapter.deriveSituations?.(graph, snapshot, now) ?? [];
  const brainSnapshot = createBrainSnapshot(graph, adapter.id, now);
  const memory = adapter.memory?.(snapshot, graph, situations, now) ?? [
    memoryFromBrainSnapshot(brainSnapshot),
    ...situations.map((situation) => memoryFromSituation(situation, now)),
  ];
  return { adapter, snapshot, graph, situations, memory };
}
