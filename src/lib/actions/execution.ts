import { createMemoryEvent } from "../memory/events";
import type { MemoryEvent } from "../memory/types";
import { getAction } from "./index";
import { canExecuteAction } from "./policy";

const SAFE_EXECUTION_ALLOWLIST = new Set([
  "ops.whatChanged.show",
  "ops.needs.show",
  "ops.approvals.review",
  "lab.proxmox.open",
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
}

export async function executeSafeAction(input: ExecuteActionInput): Promise<ExecuteActionOutput> {
  const now = Date.now();
  const action = getAction(input.actionId);
  if (!action) return denied(input.actionId, "unknown action", now);
  if (!SAFE_EXECUTION_ALLOWLIST.has(action.id)) return denied(action.id, "action not in safe execution allowlist", now);
  const ctx = { source: "system" as const, actor: "umbra" as const, approved: input.approved ?? false, args: input.args ?? {} };
  const policy = canExecuteAction(action, ctx);
  if (!policy.ok) return denied(action.id, policy.reason, now);
  const result = await action.execute(ctx);
  const verify = result.ok && action.verify ? await action.verify(ctx) : null;
  return {
    ok: result.ok && (verify?.ok ?? true),
    message: verify ? `${result.message} · ${verify.message}` : result.message,
    actionId: action.id,
    memory: [
      createMemoryEvent({ source: "system", actor: "umbra", type: "action.executed", summary: result.message, result: result.ok ? "ok" : "error", actionId: action.id, raw: result, at: now }),
      ...(verify ? [createMemoryEvent({ source: "system", actor: "umbra", type: "action.verified", summary: verify.message, result: verify.ok ? "ok" : "error", actionId: action.id, raw: verify, at: Date.now() })] : []),
    ],
  };
}

function denied(actionId: string, reason: string, at: number): ExecuteActionOutput {
  return {
    ok: false,
    message: reason,
    actionId,
    memory: [createMemoryEvent({ source: "local-policy", actor: "system", type: "action.refused", summary: reason, result: "denied", actionId, at })],
  };
}
