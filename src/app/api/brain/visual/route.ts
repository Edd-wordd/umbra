import { readApprovalRequestsFile } from "@/lib/approvals/store-server";
import { addEdge, addNode, clampImportance, type BrainVisualEdge, type BrainVisualNode } from "@/lib/brain/visual";
import { getDevSummary } from "@/lib/dev/summary";
import { getLiveKnowledgeDomain } from "@/lib/domain/knowledge-server";
import { getLabHealth } from "@/lib/lab/health-server";
import { getOpsTimeline } from "@/lib/ops/timeline-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const now = Date.now();
  const [lab, knowledge, approvals, timeline, dev] = await Promise.all([
    getLabHealth(),
    getLiveKnowledgeDomain(now),
    readApprovalRequestsFile(),
    getOpsTimeline(8),
    Promise.resolve(getDevSummary(now)),
  ]);

  const nodes: BrainVisualNode[] = [];
  const edges: BrainVisualEdge[] = [];

  addDomain(nodes, "ops", "Ops", approvals.some((approval) => approval.status === "pending") ? "approval" : "silent", 0.7);
  addDomain(nodes, "lab", "Lab", lab.results.some((result) => !result.ok) ? "blocked" : lab.configured ? "silent" : "watch", lab.configured ? 0.8 : 0.35);
  addDomain(nodes, "knowledge", "Knowledge", knowledge.rejected ? "watch" : knowledge.configured ? "silent" : "watch", knowledge.configured ? 0.75 : 0.35);
  addDomain(nodes, "dev", "Dev", dev.status, 0.65);

  for (const result of lab.results.slice(0, 10)) {
    const id = `service:lab:${result.id}`;
    addNode(nodes, {
      id,
      label: result.label,
      domain: "lab",
      kind: "service",
      status: result.ok ? "ok" : result.state,
      importance: result.ok ? 0.35 : 1,
      notes: [`${result.state}`, `${result.ms}ms`],
      actions: [{ label: "open", command: `open ${result.label}` }],
    });
    addEdge(edges, { from: "domain:lab", to: id, kind: "contains", strength: result.ok ? 0.35 : 0.9 });
  }

  addNode(nodes, {
    id: "knowledge:vault",
    label: "Vault",
    domain: "knowledge",
    kind: "vault",
    status: knowledge.configured && !knowledge.error ? (knowledge.rejected ? "watch" : "ok") : "error",
    importance: knowledge.rejected ? 0.8 : 0.45,
    notes: knowledge.configured && !knowledge.error ? [`${knowledge.accepted} typed`, `${knowledge.rejected} rejected`] : [knowledge.error ?? "not configured"],
    actions: [
      { label: "session", command: "create session note" },
      { label: "decision", command: "create decision " },
      { label: "runbook", command: "create runbook " },
    ],
  });
  addEdge(edges, { from: "domain:knowledge", to: "knowledge:vault", kind: "summarizes", strength: 0.75 });

  for (const approval of approvals.filter((item) => item.status === "pending").slice(0, 6)) {
    const id = approval.id;
    addNode(nodes, {
      id,
      label: approval.actionLabel,
      domain: approval.actionId.split(".")[0] ?? "ops",
      kind: "approval",
      status: "pending",
      importance: 0.92,
      notes: [approval.risk, approval.plan.target ?? approval.actionId],
      actions: [{ label: "review", command: "review approvals" }],
    });
    addEdge(edges, { from: "domain:ops", to: id, kind: "requires_attention", strength: 1 });
  }

  addNode(nodes, {
    id: "dev:summary",
    label: "Dev summary",
    domain: "dev",
    kind: "summary",
    status: dev.status,
    importance: clampImportance(0.35 + dev.needs * 0.12),
    notes: dev.notes,
  });
  addEdge(edges, { from: "domain:dev", to: "dev:summary", kind: "summarizes", strength: 0.7 });

  for (const item of timeline.slice(0, 6)) {
    const id = `timeline:${item.id}`;
    addNode(nodes, {
      id,
      label: item.kind.replace("action.", "").replace("approval.", "approval "),
      domain: "ops",
      kind: "timeline",
      status: item.tone === "amber" ? "watch" : "ok",
      importance: item.tone === "amber" ? 0.72 : 0.42,
      notes: [item.summary],
    });
    addEdge(edges, { from: "domain:ops", to: id, kind: "recent", strength: item.tone === "amber" ? 0.7 : 0.35 });
  }

  return Response.json({ generatedAt: now, nodes: nodes.slice(0, 30), edges: edges.slice(0, 48) });
}

function addDomain(nodes: BrainVisualNode[], id: string, label: string, status: string, importance: number) {
  addNode(nodes, { id: `domain:${id}`, label, domain: id, kind: "domain", status, importance });
}
