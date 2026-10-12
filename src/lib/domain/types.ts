import type { BrainDomain, BrainGraph } from "../brain/types";
import type { MemoryEvent } from "../memory/types";
import type { Situation } from "../situations/types";

export interface DomainAdapter<TSnapshot = unknown> {
  id: BrainDomain;
  label: string;
  toGraph(snapshot: TSnapshot, now: number): BrainGraph;
  deriveSituations?: (graph: BrainGraph, snapshot: TSnapshot, now: number) => Situation[];
  memory?: (snapshot: TSnapshot, graph: BrainGraph, situations: Situation[], now: number) => MemoryEvent[];
}

export interface DomainPipelineResult<TSnapshot = unknown> {
  adapter: DomainAdapter<TSnapshot>;
  snapshot: TSnapshot;
  graph: BrainGraph;
  situations: Situation[];
  memory: MemoryEvent[];
}
