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
 *   GET  /jump/<token>        a ping's jump link (loopback only; the token is the auth)
 *   GET  /pings               recent pings with their jump links (loopback only)
 *   POST /test-ping           Bearer <long-lived token> → one sample ping (pnpm helper --test-ping)
 * The long-lived token never leaves the Next server; the browser only sees tickets.
 */
const TICKET_TTL = 60_000;
const MAX_BODY = 64 * 1024;

const REQUEST_TYPES = new Set(["term.exec", "agent.respond", "agent.dispatch", "process.kill", "server.start", "tests.run", "sessions.resume", "session.start", "term.watch", "pane.focus", "jump"]);

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

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The tiny page a jump link answers with: what happened, then it tries to close itself. */
function page(res: ServerResponse, status: number, text: string, body = "") {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" });
  res.end(
    `<!doctype html><meta charset="utf-8"><title>umbra · ${esc(text)}</title>` +
      `<body style="background:#060708;color:#aab1b9;font:12px ui-monospace,Menlo,monospace;padding:28px;line-height:1.7">` +
      `<div style="color:${status < 300 ? "#3fe3ff" : "#ffb648"}">${status < 300 ? "✓" : "✕"} ${esc(text)}</div>${body}` +
      `<div style="color:#4a5058;margin-top:10px">umbra helper · this tab can close</div>` +
      (status < 300 ? `<script>setTimeout(function(){window.close()},400)</script>` : ""),
  );
}

/** Loopback peer, and a Host header naming this helper (no DNS-rebinding page can drive it). */
function loopbackOnly(req: IncomingMessage, port: number): boolean {
  const ip = req.socket.remoteAddress ?? "";
  const host = (req.headers.host ?? "").toLowerCase();
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip) && [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(host);
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
    case "jump":
      return (r.kind === "herdr" && typeof r.sessionId === "string") || (r.kind === "cursor" && typeof r.repo === "string");
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
      if (req.method === "GET" && url.pathname.startsWith("/jump/")) {
        if (!loopbackOnly(req, config.port)) return page(res, 403, "jump links only work on this Mac");
        const token = url.pathname.slice(6);
        const target = helper.jumps.get(token);
        if (!target) {
          audit({ action: "jump", result: "refused", via: "link", why: "unknown or expired token" });
          return page(res, 404, "this jump link expired (they last 24 h)");
        }
        const r = await helper.jump(target, "link");
        if (r.redirect) {
          res.writeHead(302, { location: r.redirect, "cache-control": "no-store" });
          return res.end();
        }
        return page(res, r.ok ? 200 : 502, r.text);
      }
      if (req.method === "GET" && url.pathname === "/pings") {
        if (!loopbackOnly(req, config.port)) return page(res, 403, "only on this Mac");
        const rows = helper.pings.recent
          .map((p) => `<div><span style="color:#4a5058">${esc(new Date(p.at).toLocaleString())}</span> ${p.jump ? `<a style="color:#aab1b9" href="${esc(p.jump)}">${esc(p.title)}</a>` : esc(p.title)} <span style="color:#7d848c">· ${esc(p.message)} · ${esc(p.delivery)}</span></div>`)
          .join("");
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" });
        return res.end(`<!doctype html><meta charset="utf-8"><title>umbra · pings</title><body style="background:#060708;color:#aab1b9;font:12px ui-monospace,Menlo,monospace;padding:28px;line-height:1.9"><div style="color:#7d848c;letter-spacing:2px">RECENT PINGS</div>${rows || '<div style="color:#4a5058">none yet</div>'}`);
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
      if (req.method === "POST" && url.pathname === "/test-ping") {
        if (!authed(req)) return json(res, 401, { error: "bad token" });
        const p = await helper.testPing();
        return json(res, 200, { ok: !!p, ping: p });
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
