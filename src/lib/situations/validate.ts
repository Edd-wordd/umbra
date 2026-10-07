import { createSampleBrain } from "../brain/sample";
import { unresolvedActionRefs } from "./actions";
import type { Situation } from "./types";

export interface SituationValidationResult {
  ok: boolean;
  unresolved: Array<{ situationId: string; actionIds: string[] }>;
}

export function validateSituationActionRefs(situations: readonly Situation[]): SituationValidationResult {
  const unresolved = situations
    .map((situation) => ({ situationId: situation.id, actionIds: unresolvedActionRefs(situation) }))
    .filter((item) => item.actionIds.length > 0);
  return { ok: unresolved.length === 0, unresolved };
}

export function validateSampleSituationActionRefs(now = Date.now()): SituationValidationResult {
  return validateSituationActionRefs(createSampleBrain(now).situations);
}
