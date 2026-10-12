import type { ActionPlan } from "../actions/types";
import type { BrainRisk } from "../brain/types";

export type ApprovalStatus = "pending" | "approved" | "denied";

export interface ApprovalRequest {
  id: string;
  actionId: string;
  actionLabel: string;
  risk: BrainRisk;
  plan: ActionPlan;
  status: ApprovalStatus;
  requestedAt: number;
  source: "cmdk" | "ops" | "system";
}
