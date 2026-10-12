import { executeSafeAction } from "@/lib/actions/execution";
import { readApprovalRequestsFile } from "@/lib/approvals/store-server";
import { addMemoryEvents } from "@/lib/memory";
import { appendJournalEvents } from "@/lib/memory/journal-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { actionId?: string; args?: Record<string, string>; approvalId?: string } | null;
  if (!body?.actionId) return Response.json({ error: "actionId required" }, { status: 400 });
  const approval = body.approvalId ? (await readApprovalRequestsFile()).find((item) => item.id === body.approvalId) : null;
  if (body.approvalId && !approval) return Response.json({ error: "approval not found" }, { status: 404 });
  if (approval && approval.status !== "approved") return Response.json({ error: "approval is not approved" }, { status: 403 });
  const result = await executeSafeAction({ actionId: body.actionId, args: body.args, approved: approval?.status === "approved" });
  addMemoryEvents(result.memory);
  await appendJournalEvents(result.memory);
  return Response.json(result);
}
