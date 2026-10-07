import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { audit } from "./audit.js";
import type { HelperConfig } from "./config.js";
import type { Helper } from "./helper.js";
import { riskOf } from "./policy.js";
import type { WireRequest } from "./protocol.js";

/**
 * HTTP + WebSocket on 127.0.0.1 only.
 *   GET  /health              no auth, no secrets (liveness for the app)
 *   POST /session             Bearer <long-lived token> → { token, expiresAt } single-use socket ticket (60 s)
 *   POST /approvals           Bearer <long-lived token> { action } → { approvalId } for one risky action (60 s)
 *   GET  /ws?ticket=…         WebSocket: snapshot + events out, requests in
 * The long-lived token never leaves the Next server; the browser only sees tickets.
 */
const TICKET_TTL = 60_000;
const MAX_BODY = 64 * 1024;

const REQUEST_TYPES = new Set(["term.exec", "agent.respond", "agent.dispatch", "process.kill", "server.start", "tests.run", "sessions.resume", "session.start", "term.watch", "pane.focus"]);

export function isLocalOrigin(origin: string | undefined, extra: string[]): boolean {
  if (!origin) return true; // non-browser client (it still needs a ticket)
  if (extra.includes(origin)) return true;
  try {
    const u = new URL(origin);
    return (u.protocol === "http:" || u.protocol === "https:") && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(new Error("invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};

export function isWireRequest(x: unknown): x is WireRequest {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  if (typeof r.type !== "string" || !REQUEST_TYPES.has(r.type)) return false;
  switch (r.type) {
    case "term.exec":
      return typeof r.sessionId === "string" && typeof r.command === "string" && r.command.length <= 2000;
    case "process.kill":
      return Number.isInteger(r.pid) && (r.pid as number) > 1;
    case "agent.respond":
      return typeof r.agentId === "string" && typeof r.promptId === "string" && (r.answer === "approve" || r.answer === "deny");
    case "agent.dispatch":
      return typeof r.repo === "string" && typeof r.agent === "string" && typeof r.task === "string" && r.task.length <= 2000;
    case "server.start":
      return typeof r.serverId === "string";
    case "term.watch":
      return typeof r.sessionId === "string" && typeof r.on === "boolean";
    case "pane.focus":
      return typeof r.sessionId === "string";
    case "tests.run":
    case "session.start":
      return typeof r.repo === "string";
    default:
      return true;
  }
}

export function startServer(config: HelperConfig, helper: Helper) {
  const tickets = new Map<string, number>();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

  const authed = (req: IncomingMessage) => {
    const h = req.headers.authorization ?? "";
    return h.startsWith("Bearer ") && sameSecret(h.slice(7), config.token);
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    try {
      if (req.method === "GET" && url.pathname === "/health") {
        return json(res, 200, { ok: true, name: "umbra-helper", version: helper.info().version, uptime: Math.round(process.uptime()), clients: helper.clients, herdr: helper.herdr.mode });
      }
      // Authenticated endpoints are server-to-server (Next route → helper): no browser origins at all.
      if (req.headers.origin) return json(res, 403, { error: "browser origins not allowed here" });
      if (req.method === "POST" && url.pathname === "/session") {
        if (!authed(req)) return json(res, 401, { error: "bad token" });
        const now = Date.now();
        for (const [t, exp] of tickets) if (exp < now) tickets.delete(t);
        const ticket = randomBytes(24).toString("base64url");
        tickets.set(ticket, now + TICKET_TTL);
        return json(res, 200, { ticket, expiresAt: now + TICKET_TTL, info: helper.info() });
      }
      if (req.method === "POST" && url.pathname === "/approvals") {
        if (!authed(req)) return json(res, 401, { error: "bad token" });
        const body = (await readBody(req)) as { action?: unknown; via?: unknown };
        if (!isWireRequest(body.action)) return json(res, 400, { error: "invalid action" });
        const risk = riskOf(body.action);
        if (!risk.risky) return json(res, 400, { error: "action is not risky; no approval needed" });
        const a = helper.approvals.issue(body.action);
        const { type } = body.action;
        audit({
          action: "approval",
          result: "issued",
          approvalId: a.approvalId,
          for: type,
          reason: risk.reason,
          ...(body.action.type === "process.kill" ? { pid: body.action.pid } : body.action.type === "term.exec" ? { command: body.action.command } : {}),
          via: typeof body.via === "string" ? body.via.slice(0, 60) : "app",
        });
        return json(res, 200, a);
      }
      return json(res, 404, { error: "not found" });
    } catch (e) {
      return json(res, 400, { error: (e as Error).message });
    }
  });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const ticket = url.searchParams.get("ticket") ?? "";
    const exp = tickets.get(ticket);
    const origin = req.headers.origin;
    const reject = (code: number, msg: string) => {
      socket.write(`HTTP/1.1 ${code} ${msg}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    if (url.pathname !== "/ws") return reject(404, "Not Found");
    if (!isLocalOrigin(origin, config.allowedOrigins)) return reject(403, "Forbidden origin");
    if (!exp || exp < Date.now()) return reject(401, "Unauthorized");
    tickets.delete(ticket); // single use
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const origin = req.headers.origin ?? "no-origin";
    const send = (ev: unknown) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(ev));
    send({ type: "snapshot", snapshot: helper.snapshot() });
    const off = helper.subscribe(send);
    let alive = true;
    ws.on("pong", () => (alive = true));
    const ping = setInterval(() => {
      if (!alive) return ws.terminate();
      alive = false;
      ws.ping();
    }, 30_000);
    ws.on("message", (data) => {
      let msg: unknown;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (!isWireRequest(msg)) {
        send({ type: "notice", text: "helper ignored a malformed request", result: "error" });
        return;
      }
      void helper.handle(msg, origin);
    });
    ws.on("close", () => {
      clearInterval(ping);
      off();
    });
    console.log(`[ws] app connected (${origin}) · ${helper.clients} client(s)`);
  });

  return new Promise<typeof server>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => resolve(server));
  });
}
