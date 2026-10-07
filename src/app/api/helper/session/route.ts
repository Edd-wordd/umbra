import { callHelper, guard, helperEnv } from "@/lib/helper/server";

/**
 * POST /api/helper/session → { configured: false }
 *                          | { configured: true, ticket, expiresAt, wsUrl, info }
 * Mints a single-use, 60 s socket ticket from the Mac helper using the
 * long-lived token (server-side only). The browser then opens
 * ws://127.0.0.1:<port>/ws?ticket=… directly: loopback, so only this Mac.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const refused = guard(req);
  if (refused) return refused;
  const env = helperEnv();
  if (!env) return Response.json({ configured: false });
  try {
    const { status, json } = await callHelper(env, "/session");
    if (status !== 200 || typeof json.ticket !== "string") {
      return Response.json({ configured: true, error: status === 401 ? "helper rejected the token · re-copy it with `pnpm helper --print-env`" : `helper answered ${status}` }, { status: 502 });
    }
    return Response.json({ configured: true, ticket: json.ticket, expiresAt: json.expiresAt, wsUrl: env.url.replace(/^http/, "ws") + "/ws", info: json.info });
  } catch {
    return Response.json({ configured: true, error: "helper not running · start it with `pnpm helper`" }, { status: 502 });
  }
}
