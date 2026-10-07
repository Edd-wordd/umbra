import { callHelper, guard, helperEnv } from "@/lib/helper/server";

/**
 * POST /api/helper/approve { action } → { approvalId, expiresAt }
 * Called only after Edward clicks APPROVE on the approval strip. The helper
 * issues a one-shot id bound to exactly this action (60 s) and audits it;
 * without one it refuses kill / push / rm / restart and friends.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPROVABLE = new Set(["term.exec", "process.kill"]);

export async function POST(req: Request) {
  const refused = guard(req);
  if (refused) return refused;
  const env = helperEnv();
  if (!env) return Response.json({ error: "helper not configured" }, { status: 404 });
  let body: { action?: { type?: unknown } };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const action = body.action;
  if (!action || typeof action.type !== "string" || !APPROVABLE.has(action.type)) return Response.json({ error: "nothing to approve" }, { status: 400 });
  try {
    const { status, json } = await callHelper(env, "/approvals", { action, via: "umbra approval strip" });
    return Response.json(json, { status });
  } catch {
    return Response.json({ error: "helper not reachable" }, { status: 502 });
  }
}
