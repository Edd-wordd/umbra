import type { BrainRisk } from "../brain/types";
import type { ActionContext, UmbraAction } from "./types";

const APPROVAL_RISKS = new Set<BrainRisk>(["local-risky", "external", "destructive", "physical", "financial", "security"]);

export function actionRequiresApproval(action: UmbraAction): boolean {
  if (action.approvalPolicy === "none") return false;
  if (action.approvalPolicy === "required") return true;
  return APPROVAL_RISKS.has(action.risk);
}

export function canExecuteAction(action: UmbraAction, ctx: ActionContext): { ok: true } | { ok: false; reason: string } {
  if (actionRequiresApproval(action) && !ctx.approved) {
    return { ok: false, reason: `${action.label} requires explicit approval` };
  }
  return { ok: true };
}
