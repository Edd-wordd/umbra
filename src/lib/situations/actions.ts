import { getAction } from "../actions";
import type { ActionContext, ActionPlan, UmbraAction } from "../actions/types";
import { runbooksForSituation } from "../runbooks";
import type { Runbook } from "../runbooks/types";
import type { Situation } from "./types";

export interface SituationActionBinding {
  situationId: string;
  action: UmbraAction;
  label: string;
  risk: string;
}

export interface SituationActionPlan extends SituationActionBinding {
  plan: ActionPlan;
}

export function actionsForSituation(situation: Situation): SituationActionBinding[] {
  return situation.suggestedActions.flatMap((ref) => {
    const action = getAction(ref.id);
    if (!action) return [];
    return [{ situationId: situation.id, action, label: ref.label || action.label, risk: ref.risk ?? action.risk }];
  });
}

export async function dryRunSituationActions(situation: Situation, ctx: ActionContext): Promise<SituationActionPlan[]> {
  const bindings = actionsForSituation(situation);
  const plans = await Promise.all(bindings.map(async (binding) => ({ ...binding, plan: await binding.action.dryRun(ctx) })));
  return plans;
}

export function unresolvedActionRefs(situation: Situation): string[] {
  return situation.suggestedActions.map((ref) => ref.id).filter((id) => !getAction(id));
}

export interface SituationRunbookBinding {
  situationId: string;
  runbook: Runbook;
}

export function boundRunbooksForSituation(situation: Situation): SituationRunbookBinding[] {
  return runbooksForSituation(situation).map((runbook) => ({ situationId: situation.id, runbook }));
}
