"use client";

import { useDevStore } from "./store";
import type { DevEvent, DevSnapshot } from "./types";

/**
 * Live link to the Mac helper (helper/) over a loopback WebSocket:
 *
 *   1. POST /api/helper/session (Next, server-side token) → one-time ticket
 *   2. ws://127.0.0.1:<port>/ws?ticket=…  → snapshot, then events
 *
 * The only thing the app sends back is a jump request. Reconnects with
 * backoff; the long-lived token never reaches this file.
 */

interface SessionReply {
  configured: boolean;
  ticket?: string;
  wsUrl?: string;
  error?: string;
  info?: { hostname?: string; gh?: string; herdr?: string };
}

const BACKOFF = [3000, 5000, 10000, 15000];

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
    let reply: SessionReply;
    try {
      const res = await fetch("/api/helper/session", { method: "POST" });
      reply = (await res.json()) as SessionReply;
    } catch {
      reply = { configured: true, error: "app server unreachable" };
    }
    if (stopped) return;
    if (!reply.configured) return store().setHelper({ state: "off" });
    if (!reply.ticket || !reply.wsUrl) {
      store().setHelper({ state: "down", error: reply.error });
      return retry();
    }
    const info = reply.info ?? {};
    const sock = new WebSocket(`${reply.wsUrl}?ticket=${encodeURIComponent(reply.ticket)}`);
    ws = sock;
    let attached = false;

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
        store().attach((req) => sock.readyState === WebSocket.OPEN && sock.send(JSON.stringify(req)), ev.snapshot as DevSnapshot);
        store().setHelper({ state: "live", hostname: info.hostname, gh: info.gh, herdr: info.herdr });
        return;
      }
      if (attached) store().apply(ev);
    };
    sock.onclose = () => {
      if (ws === sock) ws = null;
      if (stopped) return;
      if (attached) store().detach();
      store().setHelper({ state: "down", error: attached ? "connection lost" : "socket refused" });
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
