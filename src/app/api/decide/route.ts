import { decide, jevConfigured } from "@/lib/decide/decide";
import { JEV_MODEL } from "@/lib/decide/jev";
import { isTaskName } from "@/lib/decide/tasks";

/**
 * POST /api/decide  { task: "triage" | "risk", items: [{ id, input }] }
 *   → { results: DecideResult[] }   (source "jev" or "local" per item)
 * GET  /api/decide  → { jev: boolean, model }   (never returns the key)
 *
 * TYPESAFE_API_KEY is read here, on the server only (.env.local).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 16;

export async function GET() {
  return Response.json({ jev: jevConfigured(), model: JEV_MODEL });
}

export async function POST(req: Request) {
  let body: { task?: unknown; items?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!isTaskName(body.task)) return Response.json({ error: "unknown task" }, { status: 400 });
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ITEMS)
    return Response.json({ error: `items: 1–${MAX_ITEMS}` }, { status: 400 });
  const task = body.task;
  const results = await Promise.all(
    body.items.map((it) => {
      const item = it as { id?: unknown; input?: unknown };
      return typeof item?.id === "string" ? decide(task, item.id.slice(0, 120), item.input) : Promise.resolve(null);
    }),
  );
  return Response.json({ results: results.filter(Boolean) });
}
