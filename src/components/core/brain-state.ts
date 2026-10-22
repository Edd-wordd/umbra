import type { BrainSummary, BrainSummaryDomain } from "../console/useBrainSummary";

export type CoreBrainVisualStatus = "quiet" | "watch" | "approval" | "blocked";

export interface CoreBrainDomainState {
  id: string;
  status: string;
  source: string;
  intensity: number;
  live: boolean;
  notes: string[];
}

export interface CoreBrainState {
  status: CoreBrainVisualStatus;
  energy: number;
  needs: number;
  approvals: number;
  liveDomains: number;
  recentActivity: boolean;
  domains: CoreBrainDomainState[];
}

export function brainSummaryToCoreState(summary: BrainSummary | null): CoreBrainState {
  if (!summary) return emptyCoreBrainState();
  const domains = summary.domains.map(domainToCoreState);
  const status = worstStatus(summary.domains, summary.totals.approvals);
  const liveDomains = domains.filter((domain) => domain.live).length;
  const needs = summary.totals.needs;
  const approvals = summary.totals.approvals;
  const recentActivity = Boolean(summary.latestTimeline);
  const energy = clamp((needs * 0.12) + (approvals * 0.18) + (recentActivity ? 0.12 : 0) + (liveDomains * 0.025), 0.08, 1);
  return { status, energy, needs, approvals, liveDomains, recentActivity, domains };
}

function domainToCoreState(domain: BrainSummaryDomain): CoreBrainDomainState {
  const base = domain.status === "blocked" ? 1 : domain.status === "approval" ? 0.82 : domain.status === "watch" || domain.status === "actionable" ? 0.55 : 0.12;
  const sourceBoost = domain.source === "live" ? 0.12 : domain.source === "partial" ? 0.06 : 0;
  return {
    id: domain.id,
    status: domain.status,
    source: domain.source,
    intensity: clamp(base + sourceBoost + domain.needs * 0.04, 0, 1),
    live: domain.source === "live" || domain.source === "partial",
    notes: domain.notes,
  };
}

function worstStatus(domains: BrainSummaryDomain[], approvals: number): CoreBrainVisualStatus {
  if (domains.some((domain) => domain.status === "blocked")) return "blocked";
  if (approvals > 0 || domains.some((domain) => domain.status === "approval")) return "approval";
  if (domains.some((domain) => domain.status === "watch" || domain.status === "actionable")) return "watch";
  return "quiet";
}

function emptyCoreBrainState(): CoreBrainState {
  return { status: "quiet", energy: 0.08, needs: 0, approvals: 0, liveDomains: 0, recentActivity: false, domains: [] };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
