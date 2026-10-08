import type { BrainSnapshot } from "../brain/snapshot";
import { diffSnapshots } from "../brain/snapshot";
import type { BrainNode } from "../brain/types";
import type { MemoryEvent } from "../memory/types";
import { eventsSince } from "../memory/timeline";
import type { OpsNeed } from "./types";

export interface WhatChangedItem {
  id: string;
  kind: "need" | "memory" | "graph";
  severity: "critical" | "attention" | "info";
  summary: string;
  at?: number;
  entities?: string[];
}

export interface WhatChangedSummary {
  since: number;
  generatedAt: number;
  items: WhatChangedItem[];
  lines: string[];
  quiet: boolean;
}

export function buildWhatChanged(input: {
  since: number;
  generatedAt?: number;
  needs?: readonly OpsNeed[];
  memory?: readonly MemoryEvent[];
  before?: BrainSnapshot;
  after?: BrainSnapshot;
  limit?: number;
}): WhatChangedSummary {
  const generatedAt = input.generatedAt ?? Date.now();
  const items: WhatChangedItem[] = [];

  for (const need of input.needs ?? []) {
    if (need.situation.updatedAt < input.since) continue;
    items.push({
      id: `need:${need.id}`,
      kind: "need",
      severity: need.severity === "critical" || need.severity === "blocked" || need.severity === "approval" ? "attention" : "info",
      summary: `${need.title} · ${need.whyNow}`,
      at: need.situation.updatedAt,
      entities: need.situation.entities,
    });
  }

  for (const event of eventsSince(input.memory ?? [], input.since)) {
    items.push({
      id: `memory:${event.id}`,
      kind: "memory",
      severity: event.result === "error" || event.result === "denied" || event.result === "pending" ? "attention" : "info",
      summary: event.summary,
      at: event.timestamp,
      entities: event.entities,
    });
  }

  if (input.before && input.after) {
    const diff = diffSnapshots(input.before, input.after);
    for (const node of diff.addedNodes) items.push(graphItem("added", node, generatedAt));
    for (const node of diff.changedNodes) items.push(graphItem("changed", node, generatedAt));
    for (const node of diff.removedNodes) items.push(graphItem("removed", node, generatedAt));
  }

  const deduped = dedupe(items)
    .sort((a, b) => severityRank(b) - severityRank(a) || (b.at ?? 0) - (a.at ?? 0))
    .slice(0, input.limit ?? 8);
  return { since: input.since, generatedAt, items: deduped, lines: formatWhatChangedLines(deduped), quiet: deduped.length === 0 };
}

export function formatWhatChangedLines(items: readonly WhatChangedItem[]): string[] {
  if (!items.length) return ["all quiet"];

  const needs = items.filter((item) => item.kind === "need");
  const knowledge = items.filter((item) => item.summary.includes("indexed note") || item.summary.includes("skipped note"));
  const other = items.filter((item) => !needs.includes(item) && !knowledge.includes(item));
  const lines: string[] = [];

  for (const item of needs) lines.push(`needs · ${compactSummary(item.summary)}`);

  if (knowledge.length) {
    const indexed = knowledge.filter((item) => item.summary.startsWith("indexed note")).length;
    const skipped = knowledge.filter((item) => item.summary.startsWith("skipped note")).length;
    lines.push(`knowledge · indexed ${indexed} trusted note${indexed === 1 ? "" : "s"}${skipped ? ` · skipped ${skipped}` : ""}`);
  }

  for (const item of other) lines.push(`${item.kind} · ${compactSummary(item.summary)}`);
  return lines.slice(0, 6);
}

function graphItem(change: "added" | "changed" | "removed", node: BrainNode, at: number): WhatChangedItem {
  return {
    id: `graph:${change}:${node.id}`,
    kind: "graph",
    severity: node.status && !["silent", "fyi"].includes(node.status) ? "attention" : "info",
    summary: `${change} ${node.type} · ${node.label}`,
    at,
    entities: [node.id],
  };
}

function severityRank(item: WhatChangedItem): number {
  if (item.severity === "critical") return 3;
  if (item.severity === "attention") return 2;
  return 1;
}

function compactSummary(summary: string): string {
  return summary.replace(/\s+·\s+/g, " · ").replace(/^brain snapshot · /, "snapshot · ");
}

function dedupe(items: WhatChangedItem[]): WhatChangedItem[] {
  const seen = new Set<string>();
  const out: WhatChangedItem[] = [];
  for (const item of items) {
    const key = `${item.kind}:${item.summary}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
