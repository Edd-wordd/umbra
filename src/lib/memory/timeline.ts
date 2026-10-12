import type { MemoryEvent } from "./types";

export function sortTimeline(events: readonly MemoryEvent[]): MemoryEvent[] {
  return [...events].sort((a, b) => b.timestamp - a.timestamp);
}

export function eventsSince(events: readonly MemoryEvent[], since: number): MemoryEvent[] {
  return sortTimeline(events.filter((event) => event.timestamp >= since));
}

export function eventsForEntity(events: readonly MemoryEvent[], entityId: string): MemoryEvent[] {
  return sortTimeline(events.filter((event) => event.entities?.includes(entityId)));
}

export function summarizeSince(events: readonly MemoryEvent[], since: number, limit = 5): string[] {
  return eventsSince(events, since)
    .slice(0, limit)
    .map((event) => event.summary);
}
