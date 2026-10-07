if (typeof window !== "undefined") throw new Error("lib/helper/server is server-only");

/**
 * Server side of the Mac helper link. UMBRA_HELPER_URL / UMBRA_HELPER_TOKEN
 * come from .env.local and never leave this process: the browser only ever
 * receives single-use, 60-second socket tickets and one-shot approval ids.
 */

export interface HelperEnv {
  url: string;
  token: string;
}

export function helperEnv(): HelperEnv | null {
  const url = process.env.UMBRA_HELPER_URL?.trim();
  const token = process.env.UMBRA_HELPER_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    const u = new URL(url);
    // v1: the helper is loopback only (Tailscale later).
    if (!["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)) return null;
  } catch {
    return null;
  }
  return { url: url.replace(/\/+$/, ""), token };
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const hostnameOf = (host: string) => (host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0]).toLowerCase();

/**
 * Only the Mac itself may use these routes: `next dev` listens on every
 * interface, so a phone on the LAN could otherwise reach them. The Host
 * check also defeats DNS rebinding; Origin must match Host (no cross-site POSTs).
 */
export function guard(req: Request): Response | null {
  const host = req.headers.get("host") ?? "";
  if (!LOCAL_HOSTS.has(hostnameOf(host))) return Response.json({ error: "helper routes answer on localhost only" }, { status: 403 });
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== host) return Response.json({ error: "cross-origin request refused" }, { status: 403 });
    } catch {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }
  }
  if (req.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "cross-site request refused" }, { status: 403 });
  return null;
}

/** Server → helper call with the long-lived token. Never send a browser Origin. */
export async function callHelper(env: HelperEnv, path: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(env.url + path, {
    method: "POST",
    headers: { authorization: `Bearer ${env.token}`, "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  return { status: res.status, json };
}
