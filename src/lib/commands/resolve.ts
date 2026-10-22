import { readApprovalRequestsFile } from "../approvals/store-server";
import type { BrainVisualNode } from "../brain/visual";
import { getDevSummary } from "../dev/summary";
import { getLiveKnowledgeDomain } from "../domain/knowledge-server";
import { getLabHealth } from "../lab/health-server";
import { routeCommand } from "./router";

export async function routeCommandWithContext(input: string, contextNodeId?: string | null) {
  const contextRoute = contextNodeId ? await routeContextCommand(input, contextNodeId) : null;
  return routeCommand(contextRoute ?? input);
}

async function routeContextCommand(input: string, contextNodeId: string): Promise<string | null> {
  if (!/\b(this|selected|that)\b/i.test(input)) return null;
  const node = await getContextNode(contextNodeId);
  const open = node?.actions?.find((action) => /\bopen\b/i.test(action.label));
  if (/\bopen\b/i.test(input) && open) return open.command;
  const first = node?.actions?.[0];
  return first?.command ?? null;
}

async function getContextNode(contextNodeId: string): Promise<BrainVisualNode | null> {
  const now = Date.now();
  const [lab, knowledge, approvals, dev] = await Promise.all([getLabHealth(), getLiveKnowledgeDomain(now), readApprovalRequestsFile(), Promise.resolve(getDevSummary(now))]);
  if (contextNodeId.startsWith("service:lab:")) {
    const id = contextNodeId.replace("service:lab:", "");
    const result = lab.results.find((item) => item.id === id);
    if (!result) return null;
    return { id: contextNodeId, label: result.label, domain: "lab", kind: "service", status: result.ok ? "ok" : result.state, importance: result.ok ? 0.35 : 1, actions: [{ label: "open", command: `open ${result.label}` }] };
  }
  if (contextNodeId === "knowledge:vault") {
    return {
      id: contextNodeId,
      label: "Vault",
      domain: "knowledge",
      kind: "vault",
      status: knowledge.configured && !knowledge.error ? (knowledge.rejected ? "watch" : "ok") : "error",
      importance: 0.7,
      actions: [
        { label: "session", command: "create session note" },
        { label: "decision", command: "create decision " },
        { label: "runbook", command: "create runbook " },
      ],
    };
  }
  const approval = approvals.find((item) => item.id === contextNodeId);
  if (approval) return { id: approval.id, label: approval.actionLabel, domain: "ops", kind: "approval", status: approval.status, importance: 0.9, actions: [{ label: "review", command: "review approvals" }] };
  if (contextNodeId === "dev:summary") return { id: contextNodeId, label: "Dev summary", domain: "dev", kind: "summary", status: dev.status, importance: 0.5, actions: [{ label: "show", command: "show needs" }] };
  return null;
}
