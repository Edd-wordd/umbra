export * from "./types";
export * from "./dev";

import { DEV_RUNBOOKS } from "./dev";
import type { Situation } from "../situations/types";
import type { Runbook } from "./types";

export const RUNBOOKS: readonly Runbook[] = [...DEV_RUNBOOKS];

export function getRunbook(id: string): Runbook | undefined {
  return RUNBOOKS.find((runbook) => runbook.id === id);
}

export function runbooksForSituation(situation: Situation): Runbook[] {
  const types = new Set([situation.type, ...(situation.sourceTypes ?? [])]);
  return RUNBOOKS.filter((runbook) => runbook.triggers.some((trigger) => types.has(trigger)));
}
