import type { BrainNode, BrainRisk, BrainStatus } from "../brain/types";
import type { ActionPlan } from "../actions/types";
import type { MemoryEvent } from "../memory/types";
import type { Runbook } from "../runbooks/types";
import type { Situation } from "../situations/types";

export interface OpsNeedAction {
  id: string;
  label: string;
  risk: BrainRisk;
  requiresApproval: boolean;
  plan?: ActionPlan;
}

export interface OpsNeed {
  id: string;
  title: string;
  severity: BrainStatus;
  whyNow: string;
  situation: Situation;
  entities: BrainNode[];
  runbooks: Runbook[];
  actions: OpsNeedAction[];
  memory: MemoryEvent[];
}
