import { createApprovalId } from "@/lib/approvals";
import { addApprovalRequestFile, decideApprovalRequestFile, readApprovalRequestsFile } from "@/lib/approvals/store-server";
import { getAction } from "@/lib/actions";
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
  return Response.json({ approval: request });
}
