import { getAction } from "../actions";
import { buildGraphExamples } from "../brain/examples";
import type { BrainGraph } from "../brain/types";
import { routeCommandSamples } from "../commands";
import { DOMAIN_ADAPTERS, DOMAIN_READINESS } from "../domain";
import { RUNBOOKS } from "../runbooks";
import type { Situation } from "../situations/types";

export type ArchitectureCheckStatus = "pass" | "warn" | "fail";

export interface ArchitectureCheck {
  id: string;
  label: string;
  status: ArchitectureCheckStatus;
  detail: string;
}

export async function runArchitectureChecks(input: { graph: BrainGraph; situations: readonly Situation[] }): Promise<ArchitectureCheck[]> {
  return [
    checkSituationActions(input.situations),
    checkRunbookActions(),
    await checkCommandRoutes(),
    checkGraphExamples(input.graph),
    checkDomainReadiness(),
  ];
}

function checkSituationActions(situations: readonly Situation[]): ArchitectureCheck {
  const missing = situations.flatMap((situation) =>
    situation.suggestedActions.filter((action) => !getAction(action.id)).map((action) => `${situation.id} → ${action.id}`),
  );
  return {
    id: "situation-actions",
    label: "Situation action refs",
    status: missing.length ? "fail" : "pass",
    detail: missing.length ? missing.join("; ") : `${situations.length} situations OK`,
  };
}

function checkRunbookActions(): ArchitectureCheck {
  const missing = RUNBOOKS.flatMap((runbook) =>
    runbook.steps.filter((step) => step.actionId && !getAction(step.actionId)).map((step) => `${runbook.id} → ${step.actionId}`),
  );
  return {
    id: "runbook-actions",
    label: "Runbook action refs",
    status: missing.length ? "fail" : "pass",
    detail: missing.length ? missing.join("; ") : `${RUNBOOKS.length} runbooks OK`,
  };
}

async function checkCommandRoutes(): Promise<ArchitectureCheck> {
  const routes = await routeCommandSamples(["open Proxmox", "restart Immich", "show what changed since I left", "send follow-up to the lead", "check astro gear"]);
  const unresolved = routes.filter((route) => route.unresolved || !route.actionId).map((route) => route.input);
  return {
    id: "command-routes",
    label: "Command route samples",
    status: unresolved.length ? "fail" : "pass",
    detail: unresolved.length ? `unresolved: ${unresolved.join(", ")}` : `${routes.length} command samples OK`,
  };
}

function checkGraphExamples(graph: BrainGraph): ArchitectureCheck {
  const examples = buildGraphExamples(graph);
  const missing = examples.filter((example) => !example.path).map((example) => example.title);
  return {
    id: "graph-examples",
    label: "Graph traversal examples",
    status: missing.length ? "warn" : "pass",
    detail: missing.length ? `missing paths: ${missing.join(", ")}` : `${examples.length} graph examples OK`,
  };
}

function checkDomainReadiness(): ArchitectureCheck {
  const adapterIds = new Set<string>(DOMAIN_ADAPTERS.map((adapter) => adapter.id));
  const readinessIds = new Set<string>(
    DOMAIN_READINESS.filter((entry) => entry.id !== "comms" && entry.id !== "life_ops" && entry.id !== "desk_robot").map((entry) => entry.id),
  );
  const missingReadiness = [...adapterIds].filter((id) => !readinessIds.has(id));
  const missingAdapters = [...readinessIds].filter((id) => !adapterIds.has(id));
  const problems = [...missingReadiness.map((id) => `adapter ${id} missing readiness`), ...missingAdapters.map((id) => `readiness ${id} missing adapter`)];
  return {
    id: "domain-readiness",
    label: "Domain readiness registry",
    status: problems.length ? "fail" : "pass",
    detail: problems.length ? problems.join("; ") : `${adapterIds.size} adapters match readiness`,
  };
}
