import type { UmbraAction, ActionPlan } from "../actions/types";

export type CommandRouteSource = "local" | "jev";

export interface CommandRoute {
  input: string;
  source: CommandRouteSource;
  actionId?: string;
  confidence: number;
  reason: string;
  args: Record<string, string>;
  action?: UmbraAction;
  requiresApproval?: boolean;
  plan?: ActionPlan;
  unresolved?: boolean;
}
