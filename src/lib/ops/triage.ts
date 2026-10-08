import { combineTriage, localTriage } from "../decide/triage";
import type { TriageDecision } from "../decide/triage";
import type { DevSignal, SignalKind } from "../dev/signals";
import type { OpsNeed } from "./types";

const KIND_BY_SITUATION: Record<string, SignalKind> = {
  blocked_agent: "agent.waiting",
  failed_ci: "ci.failed",
  stale_port: "port.stale",
  service_attention: "service",
  project_blocked: "agent.failed",
  dirty_repo: "unpushed.stale",
  local_only_work: "unpushed.stale",
  lead_warm: "lead.new",
  lead_needs_followup: "lead.new",
  proposal_viewed: "lead.new",
  service_down: "service",
  container_restart_loop: "container.restarts",
};

export interface OpsTriageDecision extends TriageDecision {
  needId: string;
}

export function localTriageOpsNeed(need: OpsNeed): OpsTriageDecision {
  const signal = signalFromOpsNeed(need);
  const answers = localTriage(signal);
  return { ...combineTriage(signal, answers, { source: "local", model: "local-heuristic", ms: 0, fallback: "jev not configured" }), needId: need.id };
}

export function localTriageOpsNeeds(needs: readonly OpsNeed[]): OpsTriageDecision[] {
  return needs.map(localTriageOpsNeed).sort((a, b) => b.priority - a.priority);
}

function signalFromOpsNeed(need: OpsNeed): DevSignal {
  const kind = KIND_BY_SITUATION[need.situation.type] ?? "service";
  const repo = need.entities.find((entity) => typeof entity.meta?.repo === "string")?.meta?.repo;
  return {
    id: need.id,
    at: need.situation.updatedAt,
    kind,
    source: `ops:${need.situation.type}`,
    repo: typeof repo === "string" ? repo : undefined,
    title: need.title,
    detail: need.whyNow,
    tone: need.severity === "blocked" || need.severity === "critical" ? "broken" : need.severity === "silent" || need.severity === "fyi" ? "info" : "attention",
    facts: {
      situation_type: need.situation.type,
      runbooks: need.runbooks.length,
      actions: need.actions.length,
      requires_approval: need.actions.some((action) => action.requiresApproval),
    },
    fix: need.actions.find((action) => !action.requiresApproval)
      ? { label: need.actions.find((action) => !action.requiresApproval)?.label ?? "OPEN", toolId: need.actions.find((action) => !action.requiresApproval)?.id ?? "ops.open" }
      : undefined,
  };
}
