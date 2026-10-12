import type { BrainRisk } from "../brain/types";
import type { SituationType } from "../situations/types";

export interface RunbookStep {
  id: string;
  title: string;
  description?: string;
  actionId?: string;
  requiresApproval?: boolean;
}

export interface Runbook {
  id: string;
  title: string;
  domain: string;
  description: string;
  triggers: SituationType[];
  risk: BrainRisk;
  steps: RunbookStep[];
  successCriteria: string[];
  failureModes: string[];
}
