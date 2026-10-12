import { routeCommand } from "@/lib/commands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { input?: string } | null;
  const input = body?.input?.trim();
  if (!input) return Response.json({ error: "input required" }, { status: 400 });
  const route = await routeCommand(input);
  return Response.json({
    input: route.input,
    source: route.source,
    actionId: route.actionId,
    confidence: route.confidence,
    reason: route.reason,
    args: route.args,
    requiresApproval: route.requiresApproval,
    plan: route.plan,
    unresolved: route.unresolved,
    action: route.action
      ? {
          id: route.action.id,
          label: route.action.label,
          risk: route.action.risk,
          domain: route.action.domain,
        }
      : undefined,
  });
}
