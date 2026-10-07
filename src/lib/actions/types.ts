import type { BrainRisk } from "../brain/types";
import type { MemoryEvent } from "../memory/types";

export type ActionDomain = "dev" | "lab" | "print" | "astro" | "business" | "cameras" | "knowledge" | "ops" | "core";

export type ActionStage = "intent" | "plan" | "riskCheck" | "dryRun" | "approval" | "execute" | "verify" | "audit";

export interface ActionContext {
  source: "touch" | "palette" | "voice" | "agent" | "runbook" | "system";
  actor: "edward" | "umbra" | "agent" | "system";
  approved?: boolean;
  args?: Readonly<Record<string, string | number | boolean | undefined>>;
}

export interface ActionPlan {
  summary: string;
  target?: string;
  command?: string;
  expectedResult?: string;
  rollbackHint?: string;
  warnings?: string[];
}

export interface ActionResult {
  ok: boolean;
  message: string;
  verified?: boolean;
  memory?: MemoryEvent[];
}

export interface UmbraAction {
  id: string;
  label: string;
  description: string;
  domain: ActionDomain;
  risk: BrainRisk;
  keywords?: readonly string[];
  preconditions?: (ctx: ActionContext) => Promise<ActionResult> | ActionResult;
  dryRun: (ctx: ActionContext) => Promise<ActionPlan> | ActionPlan;
  execute: (ctx: ActionContext) => Promise<ActionResult> | ActionResult;
  verify?: (ctx: ActionContext) => Promise<ActionResult> | ActionResult;
  approvalPolicy?: "none" | "required" | "required-on-risk";
}

export interface ActionRun {
  action: UmbraAction;
  ctx: ActionContext;
  stage: ActionStage;
  plan?: ActionPlan;
  result?: ActionResult;
}
