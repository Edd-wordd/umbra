import type { MemoryEvent } from "./types";

const events: MemoryEvent[] = [];

export function addMemoryEvents(next: MemoryEvent[]): MemoryEvent[] {
  events.push(...next);
  events.sort((a, b) => b.timestamp - a.timestamp);
  if (events.length > 200) events.length = 200;
  return next;
}

export function listMemoryEvents(limit = 20): MemoryEvent[] {
  return events.slice(0, limit);
}
