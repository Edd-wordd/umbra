import { ACTIONS } from "@/lib/actions";
import { actionRequiresApproval } from "@/lib/actions/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    actions: ACTIONS.map((action) => ({
      id: action.id,
      label: action.label,
      domain: action.domain,
      risk: action.risk,
      requiresApproval: actionRequiresApproval(action),
      keywords: action.keywords ?? [],
    })),
  });
}
