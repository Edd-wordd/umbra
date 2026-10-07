import { createMemoryEvent } from "../memory";
import type { MemorySource } from "../memory/types";
import { canExecuteAction } from "./policy";
import type { ActionContext, ActionResult, UmbraAction } from "./types";

export async function dryRunAction(action: UmbraAction, ctx: ActionContext) {
  const preconditions = action.preconditions ? await action.preconditions(ctx) : undefined;
  if (preconditions && !preconditions.ok) {
    return {
      summary: `Cannot prepare ${action.label}`,
      warnings: [preconditions.message],
    };
  }
  return action.dryRun(ctx);
}

export async function executeAction(action: UmbraAction, ctx: ActionContext): Promise<ActionResult> {
  const allowed = canExecuteAction(action, ctx);
  if (!allowed.ok) {
    return {
      ok: false,
      message: allowed.reason,
      memory: [
        createMemoryEvent({
          source: memorySource(ctx.source),
          actor: ctx.actor === "edward" ? "edward" : ctx.actor === "agent" ? "agent" : "umbra",
          type: "action.refused",
          summary: allowed.reason,
          result: "denied",
          actionId: action.id,
        }),
      ],
    };
  }

  const preconditions = action.preconditions ? await action.preconditions(ctx) : undefined;
  if (preconditions && !preconditions.ok) return preconditions;

  const result = await action.execute(ctx);
  const verification = result.ok && action.verify ? await action.verify(ctx) : undefined;
  return {
    ...result,
    verified: verification?.ok ?? result.verified,
    memory: [
      ...(result.memory ?? []),
      createMemoryEvent({
        source: memorySource(ctx.source),
        actor: ctx.actor === "edward" ? "edward" : ctx.actor === "agent" ? "agent" : "umbra",
        type: result.ok ? "action.executed" : "action.refused",
        summary: result.message,
        result: result.ok ? "ok" : "error",
        actionId: action.id,
      }),
      ...(verification?.memory ?? []),
    ],
  };
}

function memorySource(source: ActionContext["source"]): MemorySource {
  if (source === "touch") return "user";
  if (source === "palette") return "cmdk";
  if (source === "runbook") return "system";
  return source;
}
