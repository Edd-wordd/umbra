import "server-only";

import { readApprovalRequestsFile } from "../approvals/store-server";
import { readJournalEvents } from "../memory/journal-server";

export interface OpsTimelineItem {
  id: string;
  at: number;
  kind: string;
  tone: "cyan" | "amber" | "muted";
  summary: string;
  detail?: string;
}

export async function getOpsTimeline(limit = 30): Promise<OpsTimelineItem[]> {
  const [events, approvals] = await Promise.all([readJournalEvents(limit), readApprovalRequestsFile()]);
  const approvalItems: OpsTimelineItem[] = approvals.map((approval) => ({
    id: `timeline:${approval.id}`,
    at: approval.requestedAt,
    kind: `approval.${approval.status}`,
    tone: approval.status === "approved" ? "cyan" : approval.status === "denied" ? "amber" : "muted",
    summary: `${approval.actionLabel} · ${approval.risk}`,
    detail: approval.plan.target ?? approval.actionId,
  }));
  const eventItems: OpsTimelineItem[] = events.map((event) => ({
    id: `timeline:${event.id}`,
    at: event.timestamp,
    kind: event.type,
    tone: event.result === "ok" ? "cyan" : event.result === "denied" || event.result === "error" ? "amber" : "muted",
    summary: event.summary,
    detail: event.actionId,
  }));
  return [...approvalItems, ...eventItems].sort((a, b) => b.at - a.at).slice(0, limit);
}
