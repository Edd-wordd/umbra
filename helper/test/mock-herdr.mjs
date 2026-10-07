#!/usr/bin/env node
/**
 * Mock Herdr server for testing the helper without Herdr (box / CI).
 *
 *   node helper/test/mock-herdr.mjs --socket /tmp/herdr.sock --root /tmp/projects [--home /tmp/home] [--pane-pids wT:p3=1234,...]
 *
 * Serves the captured snapshot (fixtures/herdr-snapshot.json) over a unix socket,
 * newline-delimited JSON {id, method, params} → {id, result} | {id, error}, with
 * the paths under /Users/eddwordd/Documents/codes/projects rewritten to --root.
 * Supports: ping, session.snapshot, pane.read, agent.read, agent.send_keys,
 * agent.prompt, agent.focus, pane.focus, pane.send_input, pane.send_text,
 * pane.send_keys, pane.process_info, events.subscribe; and test controls:
 * mock.set_status {pane_id, status, screen?}, mock.close_workspace {workspace_id},
 * mock.reopen_workspace {workspace_id}, mock.log.
 */
import { readFileSync, rmSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const SOCK = arg("socket", "/tmp/herdr-mock.sock");
const ROOT = arg("root", "/tmp/umbra-live/projects");
const HOME = arg("home", process.env.HOME ?? "/tmp");
const panePids = Object.fromEntries((arg("pane-pids", "") || "").split(",").filter(Boolean).map((kv) => kv.split("=")).map(([k, v]) => [k, Number(v)]));

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, "fixtures/herdr-snapshot.json"), "utf8")
  .replaceAll("/Users/eddwordd/Documents/codes/projects", ROOT)
  .replaceAll("/Users/eddwordd", HOME);
const snap = JSON.parse(raw).snapshot;
const closed = new Map(); // workspace_id → {ws, panes, agents}
const log = [];

/* canned screens */
const screens = new Map();
const lines = (pane) => screens.get(pane) ?? [];
const push = (pane, ...ls) => screens.set(pane, [...lines(pane), ...ls].slice(-400));
for (const p of snap.panes) {
  const repo = (p.foreground_cwd ?? p.cwd ?? "").split("/").pop();
  if (p.agent === "cursor")
    push(p.pane_id, `  Cursor Agent · ${repo}`, "", `> ${p.terminal_title_stripped || "continue the plan"}`, "", "● Reading src/app/page.tsx", "● Editing src/lib/plan.ts (+42 −7)", "  ✓ pnpm typecheck passed", "", p.agent_status === "working" ? "  ⠋ Generating…  (esc to interrupt)" : "  → Add a follow-up", "");
  else if (p.agent === "codex")
    push(p.pane_id, ">_ OpenAI Codex (v0.50)", `  directory: ${p.cwd}`, "", "› " + (p.terminal_title_stripped || "summarize the repo").replace(/ \| .*/, ""), "", "• Explored  src/, supabase/", "• Wrote plan to docs/PLAN.md", "", "› ");
  else if (p.agent === "pi") push(p.pane_id, "π  pi coding agent", `   ${p.cwd}`, "", "idle · type a task", "");
  else if (/dev/.test(p.terminal_title_stripped ?? ""))
    push(p.pane_id, `${repo} ❯ ${p.terminal_title_stripped}`, "", "  ▲ Next.js 16.3.8 (Turbopack)", "  - Local:        http://localhost:3002", "  ✓ Ready in 1.4s", " GET / 200 in 212ms", " GET /api/health 200 in 9ms");
  else push(p.pane_id, `${(p.cwd ?? "").split("/").pop() || "~"} ❯ `);
}

const agentOf = (pane) => snap.agents.find((a) => a.pane_id === pane);
const paneOf = (pane) => snap.panes.find((p) => p.pane_id === pane);
const RANK = { blocked: 4, working: 3, done: 2, idle: 1, unknown: 0 };
const subs = new Set(); // {sock, types:Set, panes:Set}

function emit(event, data) {
  for (const s of subs) {
    const ok = s.types.has(event) && (event !== "pane.agent_status_changed" || s.panes.has(data.pane_id));
    if (ok) s.sock.write(JSON.stringify({ event, data }) + "\n");
  }
}

function setStatus(pane, status, screen) {
  const a = agentOf(pane);
  const p = paneOf(pane);
  if (!a || !p) throw err("pane_not_found", `no agent in ${pane}`);
  a.agent_status = p.agent_status = status;
  a.state_change_seq = (a.state_change_seq ?? 0) + 1;
  a.revision = p.revision = (a.revision ?? 0) + 1;
  if (status === "done") a.completion_seq = (a.completion_seq ?? 0) + 1;
  if (screen) push(pane, ...screen.split("\n"));
  const ws = snap.workspaces.find((w) => w.workspace_id === a.workspace_id);
  if (ws) ws.agent_status = snap.agents.filter((x) => x.workspace_id === ws.workspace_id).map((x) => x.agent_status).sort((x, y) => RANK[y] - RANK[x])[0] ?? "unknown";
  emit("pane.agent_status_changed", { pane_id: pane, workspace_id: a.workspace_id, agent_status: status, agent: a.agent, state_labels: [] });
}

function err(code, message) {
  return Object.assign(new Error(message), { code });
}

const keyText = (k) => ({ enter: "⏎", esc: "⎋", "ctrl+c": "^C" })[k] ?? k;

function handle(method, params = {}) {
  switch (method) {
    case "ping":
      return { type: "pong", version: snap.version, protocol: snap.protocol };
    case "session.snapshot":
      return { type: "session_snapshot", snapshot: snap };
    case "pane.read":
    case "agent.read": {
      const id = params.pane_id ?? params.target;
      const p = paneOf(id);
      if (!p) throw err("pane_not_found", `pane ${id} not found`);
      const n = params.lines ?? 60;
      const ls = params.source === "visible" || params.source === "detection" ? lines(id).slice(-40) : lines(id).slice(-n);
      return { type: "pane_read", read: { pane_id: id, workspace_id: p.workspace_id, tab_id: p.tab_id, source: params.source, format: "text", text: ls.join("\n") + "\n", revision: p.revision, truncated: false } };
    }
    case "agent.send_keys": {
      const a = agentOf(params.target);
      if (!a) throw err("agent_not_found", `no agent ${params.target}`);
      log.push({ method, target: params.target, keys: params.keys });
      push(params.target, `  [keys] ${params.keys.map(keyText).join(" ")}`);
      if (a.agent_status === "blocked") {
        const yes = params.keys[0] === "y" || params.keys[0] === "a" || (params.keys[0] === "enter" && params.keys.length === 1);
        push(params.target, yes ? "  ✓ trusted · continuing" : "  ✕ declined");
        setStatus(params.target, yes ? "working" : "idle");
        if (yes) setTimeout(() => setStatus(params.target, "done", "  ✓ finished the task"), 4000);
      }
      return { type: "ok" };
    }
    case "agent.prompt": {
      const a = agentOf(params.target);
      if (!a) throw err("agent_not_found", `no agent ${params.target}`);
      if (a.agent_status === "blocked") throw err("agent_blocked", "agent is waiting at an approval or question dialog");
      log.push({ method, target: params.target, text: params.text });
      push(params.target, "", `> ${params.text}`, "", "  ⠋ Working…");
      setStatus(params.target, "working");
      setTimeout(() => setStatus(params.target, "done", "● Done: " + params.text.slice(0, 60), ""), 3000);
      return { type: "agent_prompted", target: params.target };
    }
    case "agent.focus":
    case "pane.focus": {
      const id = params.pane_id ?? params.target;
      const p = paneOf(id);
      if (!p) throw err("pane_not_found", `pane ${id} not found`);
      log.push({ method, pane: id });
      for (const x of snap.panes) x.focused = x.pane_id === id;
      for (const x of snap.agents) x.focused = x.pane_id === id;
      for (const w of snap.workspaces) w.focused = w.workspace_id === p.workspace_id;
      snap.focused_pane_id = id;
      snap.focused_workspace_id = p.workspace_id;
      return { type: "ok" };
    }
    case "pane.send_input":
    case "pane.send_text":
    case "pane.send_keys": {
      const p = paneOf(params.pane_id);
      if (!p) throw err("pane_not_found", `pane ${params.pane_id} not found`);
      log.push({ method, pane: params.pane_id, text: params.text, keys: params.keys });
      const cwd = (p.foreground_cwd ?? p.cwd ?? "").split("/").pop() || "~";
      const ls = lines(p.pane_id);
      const last = ls.at(-1) ?? "";
      if (params.text) screens.set(p.pane_id, [...ls.slice(0, -1), last + params.text]);
      if (params.keys?.includes("enter")) push(p.pane_id, `(mock) ran: ${params.text ?? ""}`, `${cwd} ❯ `);
      if (params.keys?.includes("ctrl+c")) push(p.pane_id, "^C", `${cwd} ❯ `);
      return { type: "ok" };
    }
    case "pane.process_info": {
      const p = paneOf(params.pane_id);
      if (!p) throw err("pane_not_found", `pane ${params.pane_id} not found`);
      const pid = panePids[p.pane_id];
      return { type: "pane_process_info", process_info: { pane_id: p.pane_id, shell_pid: pid ?? null, foreground_process_group_id: pid ?? null, foreground_processes: [], tty: null } };
    }
    case "mock.set_status":
      setStatus(params.pane_id, params.status, params.screen);
      return { type: "ok" };
    case "mock.close_workspace": {
      const id = params.workspace_id;
      const ws = snap.workspaces.find((w) => w.workspace_id === id);
      if (!ws) throw err("workspace_not_found", id);
      closed.set(id, { ws, panes: snap.panes.filter((p) => p.workspace_id === id), agents: snap.agents.filter((a) => a.workspace_id === id) });
      snap.workspaces = snap.workspaces.filter((w) => w.workspace_id !== id);
      snap.panes = snap.panes.filter((p) => p.workspace_id !== id);
      snap.agents = snap.agents.filter((a) => a.workspace_id !== id);
      emit("workspace.closed", { workspace_id: id });
      return { type: "ok" };
    }
    case "mock.reopen_workspace": {
      const c = closed.get(params.workspace_id);
      if (!c) throw err("workspace_not_found", params.workspace_id);
      closed.delete(params.workspace_id);
      snap.workspaces.push(c.ws);
      snap.panes.push(...c.panes);
      snap.agents.push(...c.agents);
      emit("workspace.created", { workspace_id: params.workspace_id });
      return { type: "ok" };
    }
    case "mock.log":
      return { type: "mock_log", log };
    default:
      throw err("unknown_method", `unknown method ${method}`);
  }
}

if (existsSync(SOCK)) rmSync(SOCK);
const server = createServer((sock) => {
  sock.setEncoding("utf8");
  let buf = "";
  let sub = null;
  sock.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let req;
      try {
        req = JSON.parse(line);
      } catch {
        sock.write(JSON.stringify({ id: null, error: { code: "invalid_json", message: "invalid json" } }) + "\n");
        continue;
      }
      if (req.method === "events.subscribe") {
        const list = req.params?.subscriptions ?? [];
        sub = { sock, types: new Set(list.map((s) => s.type)), panes: new Set(list.filter((s) => s.pane_id).map((s) => s.pane_id)) };
        subs.add(sub);
        sock.write(JSON.stringify({ id: req.id, result: { type: "subscription_started" } }) + "\n");
        continue;
      }
      try {
        sock.write(JSON.stringify({ id: req.id, result: handle(req.method, req.params) }) + "\n");
      } catch (e) {
        sock.write(JSON.stringify({ id: req.id, error: { code: e.code ?? "internal", message: e.message } }) + "\n");
      }
    }
  });
  sock.on("close", () => sub && subs.delete(sub));
  sock.on("error", () => {});
});
server.listen(SOCK, () => console.log(`mock herdr ${snap.version} on ${SOCK} · ${snap.workspaces.length} workspaces · root ${ROOT}`));
const bye = () => {
  server.close();
  try {
    rmSync(SOCK);
  } catch {}
  process.exit(0);
};
process.on("SIGTERM", bye);
process.on("SIGINT", bye);
