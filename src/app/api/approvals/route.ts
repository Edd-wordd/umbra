import { createApprovalId } from "@/lib/approvals";
import { addApprovalRequestFile, decideApprovalRequestFile, readApprovalRequestsFile } from "@/lib/approvals/store-server";
import { getAction } from "@/lib/actions";
import { createMemoryEvent } from "@/lib/memory/events";
import { appendJournalEvents } from "@/lib/memory/journal-server";
import { actionRequiresApproval } from "@/lib/actions/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ approvals: await readApprovalRequestsFile() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { actionId?: string; args?: Record<string, string>; source?: "cmdk" | "ops" | "system"; id?: string; decision?: "approved" | "denied" } | null;
  if (body?.id && body.decision) {
    const approval = await decideApprovalRequestFile(body.id, body.decision);
    if (!approval) return Response.json({ error: "approval not found" }, { status: 404 });
    await appendJournalEvents([createMemoryEvent({ source: "local-policy", actor: "edward", type: body.decision === "approved" ? "approval.issued" : "approval.denied", summary: `${body.decision} · ${approval.actionLabel}`, result: body.decision === "approved" ? "ok" : "denied", actionId: approval.actionId, raw: approval })]);
    return Response.json({ approval });
  }
  if (!body?.actionId) return Response.json({ error: "actionId required" }, { status: 400 });
  const action = getAction(body.actionId);
  if (!action) return Response.json({ error: "unknown action" }, { status: 404 });
  if (!actionRequiresApproval(action)) return Response.json({ error: "action does not require approval" }, { status: 400 });
  const now = Date.now();
  const plan = await action.dryRun({ source: "palette", actor: "umbra", approved: false, args: body.args ?? {} });
  const request = await addApprovalRequestFile({
    id: createApprovalId(action.id, now),
    actionId: action.id,
    actionLabel: action.label,
    risk: action.risk,
    plan,
    status: "pending",
    requestedAt: now,
    source: body.source ?? "cmdk",
  });
  await appendJournalEvents([createMemoryEvent({ source: "local-policy", actor: "umbra", type: "approval.issued", summary: `requested approval · ${request.actionLabel}`, result: "pending", actionId: request.actionId, raw: request, at: now })]);
  return Response.json({ approval: request });
}
