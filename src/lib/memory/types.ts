export type MemorySource = "helper" | "user" | "voice" | "cmdk" | "agent" | "system" | "bridge" | "jev" | "local-policy";

export type MemoryActor = "edward" | "umbra" | "agent" | "bridge" | "system";

export type MemoryEventType =
  | "signal.received"
  | "situation.created"
  | "situation.updated"
  | "situation.resolved"
  | "decision.made"
  | "approval.issued"
  | "approval.denied"
  | "action.planned"
  | "action.executed"
  | "action.refused"
  | "action.verified"
  | "graph.snapshot"
  | "note.indexed";

export type MemoryResult = "ok" | "denied" | "error" | "info" | "pending";

export interface MemoryEvent {
  id: string;
  timestamp: number;
  source: MemorySource;
  actor: MemoryActor;
  type: MemoryEventType;
  summary: string;
  result: MemoryResult;
  entities?: string[];
  situationId?: string;
  actionId?: string;
  decisionId?: string;
  raw?: unknown;
}
