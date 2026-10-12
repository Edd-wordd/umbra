import { buildKnowledgeNote } from "../knowledge/note-content-server";
import { chooseAvailableVaultMarkdownPath, writeNewVaultMarkdown } from "../knowledge/write-server";
import { createMemoryEvent } from "../memory/events";
import type { MemoryEvent } from "../memory/types";
import { getAction } from "./index";
import type { ActionResult } from "./types";
import { canExecuteAction } from "./policy";

const SAFE_EXECUTION_ALLOWLIST = new Set([
  "ops.whatChanged.show",
  "ops.needs.show",
  "ops.approvals.review",
  "lab.proxmox.open",
  "lab.adguard.open",
  "lab.n8n.open",
  "knowledge.session.create",
  "knowledge.decision.create",
  "knowledge.runbook.create",
]);

export function canExecuteSafelyNow(actionId: string): boolean {
  return SAFE_EXECUTION_ALLOWLIST.has(actionId);
}

export interface ExecuteActionInput {
  actionId: string;
  args?: Record<string, string>;
  approved?: boolean;
}

export interface ExecuteActionOutput {
  ok: boolean;
  message: string;
  actionId: string;
  memory: MemoryEvent[];
  instruction?: { type: "open_url"; url: string };
}

export async function executeSafeAction(input: ExecuteActionInput): Promise<ExecuteActionOutput> {
  const now = Date.now();
  const action = getAction(input.actionId);
  if (!action) return denied(input.actionId, "unknown action", now);
  if (!SAFE_EXECUTION_ALLOWLIST.has(action.id)) return denied(action.id, "action not in safe execution allowlist", now);
  const ctx = { source: "system" as const, actor: "umbra" as const, approved: input.approved ?? false, args: input.args ?? {} };
  const policy = canExecuteAction(action, ctx);
  if (!policy.ok) return denied(action.id, policy.reason, now);
  const result = action.id === "knowledge.session.create" ? await executeKnowledgeCreate("session", String(ctx.args.title ?? "")) : action.id === "knowledge.decision.create" ? await executeKnowledgeCreate("decision", String(ctx.args.title ?? "")) : action.id === "knowledge.runbook.create" ? await executeKnowledgeCreate("runbook", String(ctx.args.title ?? "")) : await action.execute(ctx);
  const verify = result.ok && action.verify ? await action.verify(ctx) : null;
  return {
    ok: result.ok && (verify?.ok ?? true),
    message: verify ? `${result.message} · ${verify.message}` : result.message,
    actionId: action.id,
    instruction: result.instruction,
    memory: [
      createMemoryEvent({ source: "system", actor: "umbra", type: "action.executed", summary: result.message, result: result.ok ? "ok" : "error", actionId: action.id, raw: result, at: now }),
      ...(verify ? [createMemoryEvent({ source: "system", actor: "umbra", type: "action.verified", summary: verify.message, result: verify.ok ? "ok" : "error", actionId: action.id, raw: verify, at: Date.now() })] : []),
    ],
  };
}

async function executeKnowledgeCreate(kind: "session" | "decision" | "runbook", title: string): Promise<ActionResult> {
  const note = buildKnowledgeNote(kind, title);
  const relativePath = await chooseAvailableVaultMarkdownPath(note.relativePath);
  const result = await writeNewVaultMarkdown(relativePath, note.content);
  return { ok: result.ok, message: result.message };
}

function denied(actionId: string, reason: string, at: number): ExecuteActionOutput {
  return {
    ok: false,
    message: reason,
    actionId,
    memory: [createMemoryEvent({ source: "local-policy", actor: "system", type: "action.refused", summary: reason, result: "denied", actionId, at })],
  };
}
