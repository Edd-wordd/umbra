import { getAction } from "@/lib/actions";
import { actionRequiresApproval } from "@/lib/actions/policy";
import { createMemoryEvent } from "@/lib/memory/events";
import { appendJournalEvents } from "@/lib/memory/journal-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { actionId?: string; args?: Record<string, string> } | null;
  if (!body?.actionId) return Response.json({ error: "actionId required" }, { status: 400 });
  const action = getAction(body.actionId);
  if (!action) return Response.json({ error: "unknown action" }, { status: 404 });
  const now = Date.now();
  const plan = await action.dryRun({ source: "palette", actor: "umbra", approved: false, args: body.args ?? {} });
  const event = createMemoryEvent({ source: "cmdk", actor: "umbra", type: "action.planned", summary: plan.summary, result: "pending", actionId: action.id, raw: plan, at: now });
  await appendJournalEvents([event]);
  return Response.json({
    action: { id: action.id, label: action.label, risk: action.risk, requiresApproval: actionRequiresApproval(action) },
    plan,
    event,
  });
}
