import { readApprovalRequestsFile } from "@/lib/approvals/store-server";
import { buildBrainViewModel } from "@/lib/brain";
import { createSampleMultiDomainBrain } from "@/lib/domain";
import { getLiveKnowledgeDomain } from "@/lib/domain/knowledge-server";
import { getLabHealth } from "@/lib/lab/health-server";
import { buildOpsNeeds } from "@/lib/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const now = Date.now();
  const brain = createSampleMultiDomainBrain(now);
  const [needs, knowledge, lab] = await Promise.all([buildOpsNeeds(brain), getLiveKnowledgeDomain(now), getLabHealth()]);
  const vm = buildBrainViewModel(brain);
  const queuedApprovals = (await readApprovalRequestsFile()).filter((approval) => approval.status === "pending").length;
  return Response.json({
    generatedAt: now,
    needs: needs.length,
    approvals: vm.totals.approvals + queuedApprovals,
    changed: needs.length > 0,
    knowledge: { configured: knowledge.configured && !knowledge.error, accepted: knowledge.accepted, rejected: knowledge.rejected, nodes: knowledge.graph.nodes.length, error: knowledge.error },
    lab: { configured: lab.configured, total: lab.results.length, down: lab.results.filter((result) => !result.ok).length },
  });
}
