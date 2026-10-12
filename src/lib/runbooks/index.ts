export * from "./types";
export * from "./dev";
export * from "./print";
export * from "./astro";
export * from "./lab";
export * from "./business";
export * from "./knowledge";
export * from "./cameras";
export * from "./ops";

import { ASTRO_RUNBOOKS } from "./astro";
import { BUSINESS_RUNBOOKS } from "./business";
import { CAMERAS_RUNBOOKS } from "./cameras";
import { DEV_RUNBOOKS } from "./dev";
import { KNOWLEDGE_RUNBOOKS } from "./knowledge";
import { LAB_RUNBOOKS } from "./lab";
import { OPS_RUNBOOKS } from "./ops";
import { PRINT_RUNBOOKS } from "./print";
import type { Situation } from "../situations/types";
import type { Runbook } from "./types";

export const RUNBOOKS: readonly Runbook[] = [...DEV_RUNBOOKS, ...PRINT_RUNBOOKS, ...ASTRO_RUNBOOKS, ...LAB_RUNBOOKS, ...BUSINESS_RUNBOOKS, ...KNOWLEDGE_RUNBOOKS, ...CAMERAS_RUNBOOKS, ...OPS_RUNBOOKS];

export function getRunbook(id: string): Runbook | undefined {
  return RUNBOOKS.find((runbook) => runbook.id === id);
}

export function runbooksForSituation(situation: Situation): Runbook[] {
  const types = new Set([situation.type, ...(situation.sourceTypes ?? [])]);
  return RUNBOOKS.filter((runbook) => runbook.triggers.some((trigger) => types.has(trigger)));
}
