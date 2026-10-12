import { readApprovalRequestsFile } from "@/lib/approvals/store-server";
import { readJournalEvents } from "@/lib/memory/journal-server";
import { getLiveKnowledgeDomain } from "@/lib/domain/knowledge-server";
import { getLabHealth } from "@/lib/lab/health-server";
import { getOpsTimeline } from "@/lib/ops/timeline-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const now = Date.now();
  const [knowledge, lab, approvals, journal, timeline] = await Promise.all([getLiveKnowledgeDomain(now), getLabHealth(), readApprovalRequestsFile(), readJournalEvents(10), getOpsTimeline(1)]);
  const queuedApprovals = approvals.filter((approval) => approval.status === "pending").length;
  const labDown = lab.results.filter((result) => !result.ok).length;
  const knowledgeNeeds = knowledge.configured && !knowledge.error ? knowledge.rejected : 0;
  const recentIssues = journal.filter((event) => event.result === "denied" || event.result === "error").length;
  const needs = queuedApprovals + labDown + knowledgeNeeds + recentIssues;
  return Response.json({
    generatedAt: now,
    needs,
    approvals: queuedApprovals,
    changed: needs > 0 || timeline.length > 0,
    latest: timeline[0] ?? null,
    knowledge: { configured: knowledge.configured && !knowledge.error, accepted: knowledge.accepted, rejected: knowledge.rejected, nodes: knowledge.graph.nodes.length, error: knowledge.error },
    lab: { configured: lab.configured, total: lab.results.length, down: labDown },
  });
}
