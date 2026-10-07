import type { Situation } from "./types";

export function mergeSituationLifecycle(previous: readonly Situation[], next: readonly Situation[], now = Date.now()): Situation[] {
  const nextIds = new Set(next.map((situation) => situation.id));
  const previousById = new Map(previous.map((situation) => [situation.id, situation]));
  const merged = next.map((situation) => {
    const prior = previousById.get(situation.id);
    if (!prior) return situation;
    return {
      ...situation,
      status: prior.status === "snoozed" || prior.status === "ignored" ? prior.status : situation.status,
      createdAt: prior.createdAt,
      lastSeenAt: now,
      confidence: Math.max(prior.confidence, situation.confidence),
    } satisfies Situation;
  });

  for (const prior of previous) {
    if (nextIds.has(prior.id)) continue;
    if (prior.status === "resolved" || prior.status === "ignored") continue;
    merged.push({ ...prior, status: "resolved", updatedAt: now, lastSeenAt: prior.lastSeenAt });
  }

  return sortSituations(merged);
}

export function sortSituations(situations: readonly Situation[]): Situation[] {
  const rank = { critical: 8, blocked: 7, approval: 6, judgment: 5, actionable: 4, watch: 3, fyi: 2, silent: 1 } as const;
  return [...situations].sort((a, b) => {
    const severity = rank[b.severity] - rank[a.severity];
    if (severity) return severity;
    return b.updatedAt - a.updatedAt;
  });
}

export function activeSituations(situations: readonly Situation[]): Situation[] {
  return sortSituations(situations.filter((situation) => !["resolved", "ignored", "snoozed"].includes(situation.status)));
}
