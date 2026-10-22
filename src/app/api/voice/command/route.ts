import { routeCommandWithContext } from "@/lib/commands/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { transcript?: string; contextNodeId?: string } | null;
  const transcript = body?.transcript?.trim();
  if (!transcript) return Response.json({ error: "transcript required" }, { status: 400 });
  const route = await routeCommandWithContext(transcript, body?.contextNodeId);
  return Response.json({
    transcript,
    spokenSummary: route.unresolved ? `I could not route: ${transcript}` : `${route.action?.label ?? route.actionId} · ${route.requiresApproval ? "approval required" : "ready"}`,
    route: {
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
    },
  });
}
