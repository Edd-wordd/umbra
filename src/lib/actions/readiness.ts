import type { ApprovalRequest } from "../approvals/types";
import { getAction } from "./index";
import { canExecuteAction } from "./policy";

export interface ExecutionReadiness {
  approvalId: string;
  actionId: string;
  ready: boolean;
  reason: string;
}

export function getExecutionReadiness(approval: ApprovalRequest): ExecutionReadiness {
  const action = getAction(approval.actionId);
  if (!action) return { approvalId: approval.id, actionId: approval.actionId, ready: false, reason: "action no longer registered" };
  if (approval.status === "denied") return { approvalId: approval.id, actionId: approval.actionId, ready: false, reason: "denied, not executable" };
  if (approval.status !== "approved") return { approvalId: approval.id, actionId: approval.actionId, ready: false, reason: "waiting for approval" };
  const decision = canExecuteAction(action, { source: "system", actor: "umbra", approved: true });
  if (!decision.ok) return { approvalId: approval.id, actionId: approval.actionId, ready: false, reason: decision.reason };
  return { approvalId: approval.id, actionId: approval.actionId, ready: true, reason: "ready to execute later" };
}
