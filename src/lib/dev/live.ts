"use client";

import { useDevStore } from "./store";
import type { DevBridge, DevEvent, DevRequest, DevSnapshot } from "./types";

/**
 * Live bridge client: the Mac helper (helper/) over a loopback WebSocket.
 *
 *   1. POST /api/helper/session (Next, server-side token) → one-time ticket
 *   2. ws://127.0.0.1:<port>/ws?ticket=…  → snapshot, then events
 *   3. risky requests the user approved → POST /api/helper/approve first,
 *      then send with the approvalId the helper checks
 *
 * Falls back to the sample bridge whenever the helper isn't there, and
 * reconnects with backoff. The long-lived token never reaches this file.
 */

interface SessionReply {
  configured: boolean;
  ticket?: string;
  wsUrl?: string;
  error?: string;
  info?: { hostname?: string; pty?: string; gh?: string; herdr?: string; version?: string };
}

const BACKOFF = [3000, 5000, 10000, 15000];

const needsApproval = (req: DevRequest) => (req.type === "term.exec" || req.type === "process.kill") && req.approved;

async function approvalFor(req: DevRequest): Promise<string | null | "not-risky"> {
  const res = await fetch("/api/helper/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: req }) });
  const json = (await res.json().catch(() => ({}))) as { approvalId?: string; error?: string };
  if (res.status === 400 && /not risky/.test(json.error ?? "")) return "not-risky";
  return res.ok && json.approvalId ? json.approvalId : null;
}

export function connectHelper(): () => void {
  let stopped = false;
  let ws: WebSocket | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const store = () => useDevStore.getState();

  const retry = () => {
    if (stopped) return;
    timer = setTimeout(open, BACKOFF[Math.min(attempt++, BACKOFF.length - 1)]);
  };

  async function open() {
    if (stopped) return;
    if (store().helper.state !== "live") store().setHelper({ ...store().helper, state: "connecting" });
    let reply: SessionReply;
    try {
      const res = await fetch("/api/helper/session", { method: "POST" });
      reply = (await res.json()) as SessionReply;
    } catch {
      reply = { configured: true, error: "app server unreachable" };
    }
    if (stopped) return;
    if (!reply.configured) {
      // No UMBRA_HELPER_URL/TOKEN in .env.local: stay on sample data, don't poll.
      store().setHelper({ state: "off" });
      return;
    }
    if (!reply.ticket || !reply.wsUrl) {
      store().setHelper({ state: "down", error: reply.error });
      return retry();
    }
    const info = reply.info ?? {};
    const sock = new WebSocket(`${reply.wsUrl}?ticket=${encodeURIComponent(reply.ticket)}`);
    ws = sock;
    const listeners = new Set<(ev: DevEvent) => void>();
    let attached = false;

    const bridge: DevBridge = {
      send(req) {
        if (sock.readyState !== WebSocket.OPEN) {
          store().log("bridge", `not sent · mac helper offline · ${req.type}`, "error");
          return;
        }
        if (!needsApproval(req)) return sock.send(JSON.stringify(req));
        // Edward clicked approve: get a one-shot approval id bound to exactly this action.
        void approvalFor(req).then((id) => {
          if (id === null) return store().log("bridge", `approval not issued · ${req.type} not sent`, "error");
          sock.send(JSON.stringify(id === "not-risky" ? req : { ...req, approvalId: id }));
        });
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };

    sock.onmessage = (m) => {
      let ev: DevEvent;
      try {
        ev = JSON.parse(String(m.data)) as DevEvent;
      } catch {
        return;
      }
      if (ev.type === "snapshot" && !attached) {
        attached = true;
        attempt = 0;
        const herdr = info.herdr && !info.herdr.startsWith("off") ? "herdr" : "no herdr";
        store().attachBridge(bridge, ev.snapshot as DevSnapshot, `${info.hostname ?? "mac"} · ${herdr} · ${(ev.snapshot.projects ?? []).length} projects`);
        store().setHelper({ state: "live", hostname: info.hostname, pty: info.pty, gh: info.gh, herdr: info.herdr });
        return;
      }
      for (const fn of listeners) fn(ev);
    };
    sock.onclose = () => {
      if (ws === sock) ws = null;
      if (stopped) return;
      if (attached) store().detachBridge("connection lost");
      store().setHelper({ ...store().helper, state: "down", error: attached ? "connection lost" : "socket refused" });
      retry();
    };
    sock.onerror = () => {
      /* onclose follows */
    };
  }

  void open();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    ws?.close();
  };
}
