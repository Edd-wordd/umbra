import type { BrainSnapshot } from "../brain/snapshot";
import type { Situation } from "../situations/types";
import type { MemoryActor, MemoryEvent, MemoryEventType, MemoryResult, MemorySource } from "./types";

let seq = 0;

export function createMemoryEvent(input: {
  source: MemorySource;
  actor: MemoryActor;
  type: MemoryEventType;
  summary: string;
  result?: MemoryResult;
  entities?: string[];
  situationId?: string;
  actionId?: string;
  decisionId?: string;
  raw?: unknown;
  at?: number;
}): MemoryEvent {
  const timestamp = input.at ?? Date.now();
  seq += 1;
  return {
    id: `memory:${timestamp}:${seq.toString(36)}`,
    timestamp,
    source: input.source,
    actor: input.actor,
    type: input.type,
    summary: input.summary,
    result: input.result ?? "info",
    entities: input.entities,
    situationId: input.situationId,
    actionId: input.actionId,
    decisionId: input.decisionId,
    raw: input.raw,
  };
}

export function memoryFromSituation(situation: Situation, at = Date.now()): MemoryEvent {
  return createMemoryEvent({
    source: "system",
    actor: "umbra",
    type: "situation.created",
    summary: `${situation.title} · ${situation.whyNow}`,
    result: situation.needsHuman ? "pending" : "info",
    entities: situation.entities,
    situationId: situation.id,
    raw: situation,
    at,
  });
}

export function memoryFromBrainSnapshot(snapshot: BrainSnapshot): MemoryEvent {
  return createMemoryEvent({
    source: snapshot.source === "dev" ? "bridge" : "system",
    actor: "umbra",
    type: "graph.snapshot",
    summary: `brain snapshot · ${snapshot.graph.nodes.length} nodes · ${snapshot.graph.edges.length} edges`,
    result: "ok",
    raw: { id: snapshot.id, source: snapshot.source, at: snapshot.at },
    at: snapshot.at,
  });
}
