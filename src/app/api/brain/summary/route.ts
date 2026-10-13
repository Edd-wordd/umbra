import { createSampleMultiDomainBrain } from "@/lib/domain";
import { getDevSummary } from "@/lib/dev/summary";
import { getLiveKnowledgeDomain } from "@/lib/domain/knowledge-server";
import { readApprovalRequestsFile } from "@/lib/approvals/store-server";
import { getLabHealth } from "@/lib/lab/health-server";
import { getOpsTimeline } from "@/lib/ops/timeline-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DomainStatus = "silent" | "watch" | "actionable" | "approval" | "blocked";
type DomainSource = "live" | "partial" | "sample" | "not_configured";

export async function GET() {
  const now = Date.now();
  const [baseBrain, knowledge, lab, approvals, timeline] = await Promise.all([
    Promise.resolve(createSampleMultiDomainBrain(now)),
    getLiveKnowledgeDomain(now),
    getLabHealth(),
    readApprovalRequestsFile(),
    getOpsTimeline(8),
  ]);

  const dev = getDevSummary(now);
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
  const labDown = lab.results.filter((result) => !result.ok);
  const knowledgeRejected = knowledge.configured && !knowledge.error ? knowledge.rejected : 0;

  const domains = Object.entries(baseBrain.domains).map(([id, summary]) => {
    if (id === "lab") {
      return {
        id,
        status: lab.configured ? (labDown.length ? "blocked" : "silent") : "watch",
        source: lab.configured ? "live" satisfies DomainSource : "not_configured" satisfies DomainSource,
        configured: lab.configured,
        needs: labDown.length,
        notes: lab.configured ? [`${lab.results.length} services`, `${labDown.length} down`] : ["not configured"],
      };
    }
    if (id === "knowledge") {
      return {
        id,
        status: knowledge.configured && !knowledge.error ? (knowledgeRejected ? "watch" : "silent") : "watch",
        source: knowledge.configured && !knowledge.error ? "live" satisfies DomainSource : "not_configured" satisfies DomainSource,
        configured: knowledge.configured && !knowledge.error,
        needs: knowledgeRejected,
        notes: knowledge.configured && !knowledge.error ? [`${knowledge.accepted} typed`, `${knowledgeRejected} need structure`] : [knowledge.error ?? "not configured"],
      };
    }
    if (id === "dev") {
      return { id, status: dev.status, source: "partial" satisfies DomainSource, configured: true, needs: dev.needs, notes: dev.notes };
    }
    return {
      id,
      status: summary.critical ? "blocked" : summary.attention ? "watch" : "silent",
      source: "sample" satisfies DomainSource,
      configured: false,
      needs: summary.attention,
      notes: [`${summary.total} nodes`, `${summary.attention} attention`],
    };
  });

  const opsStatus: DomainStatus = pendingApprovals.length ? "approval" : labDown.length ? "blocked" : knowledgeRejected ? "watch" : "silent";
  domains.push({ id: "ops", status: opsStatus, source: "live" satisfies DomainSource, configured: true, needs: pendingApprovals.length + labDown.length + knowledgeRejected, notes: [`${pendingApprovals.length} approvals`, `${timeline.length} events`] });

  return Response.json({
    generatedAt: now,
    domains,
    attention: domains.filter((domain) => domain.status !== "silent"),
    totals: {
      needs: domains.reduce((sum, domain) => sum + domain.needs, 0),
      approvals: pendingApprovals.length,
      timeline: timeline.length,
    },
    latestTimeline: timeline[0] ?? null,
  });
}
