"use client";

import { create } from "zustand";
import { createDevSnapshot, createMockDevBridge, MOCK_REPOS } from "../mock/dev";
import type { Attention } from "../store";
import { shortCwd } from "./format";
import { classifyCommand } from "./risk";
import type {
  ActivityEntry,
  ActivityResult,
  ActivitySource,
  AgentKind,
  AgentSession,
  DevBridge,
  DevEvent,
  DevSnapshot,
  RepoId,
  TermLine,
} from "./types";

/**
 * Dev workspace store. A pure reducer over bridge events (`apply`) plus
 * user actions that log to the activity strip and send requests to the
 * bridge. Swap `bridge` for the Mac-helper client in Phase 2; nothing else
 * changes.
 */

export interface PendingApproval {
  id: string;
  origin: "terminal" | "ports";
  /** Exactly what will run once approved. */
  command: string;
  reason: string;
  source: ActivitySource;
  sessionId?: string;
  /** When set, approval runs this tool from the shared tool layer. */
  toolId?: string;
  args?: Record<string, string>;
}

interface DevState extends DevSnapshot {
  selectedId: string;
  pending: PendingApproval | null;
  handoffOpen: boolean;
  sentryOpen: string | null;
  activity: ActivityEntry[];
  dispatchRepo: RepoId;
  dispatchAgent: AgentKind;
  /** Select the next agent the bridge creates (set by dispatch). */
  followNewAgent: boolean;

  apply: (ev: DevEvent) => void;
  log: (source: ActivitySource, text: string, result?: ActivityResult) => void;
  select: (sessionId: string) => void;
  runCommand: (command: string, source?: ActivitySource) => void;
  approvePending: () => void;
  denyPending: () => void;
  clearPending: () => void;
  respondPrompt: (agentId: string, answer: "approve" | "deny", source?: ActivitySource) => void;
  requestKill: (port: number, source?: ActivitySource) => void;
  killPort: (port: number, opts: { approved: boolean; source: ActivitySource }) => { ok: boolean; message: string };
  startServer: (serverId: string, source?: ActivitySource) => void;
  dispatch: (task: string, source?: ActivitySource) => void;
  cycleDispatchRepo: () => void;
  cycleDispatchAgent: () => void;
  resumeSessions: (source?: ActivitySource) => void;
  toggleSentry: (id: string) => void;
  runTests: (repo: RepoId, source?: ActivitySource) => void;
  reviewDiff: (agentId: string, source?: ActivitySource) => void;
}

let n = 0;
const nid = (p: string) => `${p}${(++n).toString(36)}`;
const MAX_LOG = 60;

const initial = createDevSnapshot(Date.now());
const bridge: DevBridge = createMockDevBridge(initial);

const sessionLabel = (s: DevState, sessionId: string) => s.sessions[sessionId]?.title ?? sessionId;

export const useDevStore = create<DevState>()((set, get) => {
  const echo = (sessionId: string, text: string, kind: TermLine["kind"] = "cmd") =>
    get().apply({ type: "term.append", sessionId, lines: [{ id: nid("e"), at: Date.now(), kind, text }] });
  const promptFor = (sessionId: string) => {
    const s = get().sessions[sessionId];
    return s ? `${shortCwd(s.cwd)} ${s.branch} ❯ ` : "❯ ";
  };

  return {
    ...initial,
    selectedId: "t-umbra-agent",
    pending: null,
    handoffOpen: true,
    sentryOpen: null,
    activity: [
      { id: nid("x"), at: Date.now() - 140_000, source: "bridge", text: "sample bridge attached · 4 agents · 3 ports", result: "info" },
      { id: nid("x"), at: Date.now() - 135_000, source: "agent", text: "umbra/cursor waiting · workspace trust", result: "pending" },
    ],
    dispatchRepo: "deadbridge-site",
    dispatchAgent: "codex",
    followNewAgent: false,

    apply: (ev) =>
      set((s) => {
        switch (ev.type) {
          case "snapshot":
            return { ...ev.snapshot };
          case "agent.upsert": {
            const exists = s.agents.some((a) => a.id === ev.agent.id);
            // New sessions land on top so a dispatch is visible immediately.
            const agents = exists ? s.agents.map((a) => (a.id === ev.agent.id ? ev.agent : a)) : [ev.agent, ...s.agents];
            const follow = !exists && s.followNewAgent;
            return { agents, ...(follow ? { selectedId: ev.agent.sessionId, followNewAgent: false } : {}) };
          }
          case "session.upsert": {
            const prev = s.sessions[ev.session.id];
            return { sessions: { ...s.sessions, [ev.session.id]: { ...ev.session, lines: ev.lines ?? prev?.lines ?? [] } } };
          }
          case "term.append": {
            const prev = s.sessions[ev.sessionId];
            if (!prev) return {};
            return { sessions: { ...s.sessions, [ev.sessionId]: { ...prev, lines: [...prev.lines, ...ev.lines].slice(-400) } } };
          }
          case "term.clear": {
            const prev = s.sessions[ev.sessionId];
            return prev ? { sessions: { ...s.sessions, [ev.sessionId]: { ...prev, lines: [] } } } : {};
          }
          case "server.upsert":
            return { servers: s.servers.map((x) => (x.id === ev.server.id ? ev.server : x)) };
          case "ci.upsert":
            return {
              ci: s.ci.some((r) => r.repo === ev.run.repo)
                ? s.ci.map((r) => (r.repo === ev.run.repo ? ev.run : r))
                : [ev.run, ...s.ci],
            };
          case "notice":
            return {
              activity: [...s.activity, { id: nid("x"), at: Date.now(), source: "bridge" as const, text: ev.text, result: ev.result }].slice(-MAX_LOG),
            };
        }
      }),

    log: (source, text, result = "ok") =>
      set((s) => ({ activity: [...s.activity, { id: nid("x"), at: Date.now(), source, text, result }].slice(-MAX_LOG) })),

    select: (selectedId) => set({ selectedId }),

    runCommand: (raw, source = "touch") => {
      const command = raw.trim();
      if (!command) return;
      const s = get();
      const sessionId = s.selectedId;
      echo(sessionId, promptFor(sessionId) + command);
      if (s.pending) {
        echo(sessionId, "… one approval at a time · resolve the held action first", "dim");
        return;
      }
      const risk = classifyCommand(command);
      if (risk.risky) {
        set({ pending: { id: nid("p"), origin: "terminal", command, reason: risk.reason ?? "risky", source, sessionId } });
        get().log(source, `${sessionLabel(s, sessionId)} · \`${command}\` held · ${risk.reason}`, "pending");
        return;
      }
      get().log(source, `${sessionLabel(s, sessionId)} · ran \`${command}\``, "ok");
      bridge.send({ type: "term.exec", sessionId, command, approved: false });
    },

    approvePending: () => {
      const p = get().pending;
      if (!p) return;
      set({ pending: null });
      if (p.origin === "terminal" && p.sessionId) {
        get().log(p.source, `approved \`${p.command}\` · ${sessionLabel(get(), p.sessionId)}`, "ok");
        bridge.send({ type: "term.exec", sessionId: p.sessionId, command: p.command, approved: true });
      }
    },

    denyPending: () => {
      const p = get().pending;
      if (!p) return;
      set({ pending: null });
      if (p.sessionId) echo(p.sessionId, `✕ denied · \`${p.command}\` not run`, "dim");
      get().log(p.source, `denied \`${p.command}\``, "denied");
    },

    clearPending: () => set({ pending: null }),

    respondPrompt: (agentId, answer, source = "touch") => {
      const a = get().agents.find((x) => x.id === agentId);
      if (!a?.prompt) return;
      get().log(source, `${answer === "approve" ? "approved" : "denied"} ${a.prompt.title.toLowerCase()} · ${a.repo}/${a.agent}`, answer === "approve" ? "ok" : "denied");
      bridge.send({ type: "agent.respond", agentId, promptId: a.prompt.id, answer });
      set({ selectedId: a.sessionId });
    },

    requestKill: (port, source = "touch") => {
      const srv = get().servers.find((x) => x.port === port && x.pid);
      if (!srv?.pid || get().pending) return;
      set({
        pending: {
          id: nid("p"),
          origin: "ports",
          command: `kill ${srv.pid}`,
          reason: `kills a process · frees :${port}`,
          source,
          toolId: "dev.port.free",
          args: { port: String(port) },
        },
      });
      get().log(source, `kill ${srv.pid} (:${port}) held · needs your yes`, "pending");
    },

    killPort: (port, { approved, source }) => {
      const srv = get().servers.find((x) => x.port === port && x.pid);
      if (!srv?.pid) return { ok: false, message: `:${port} has no process` };
      if (!approved) return { ok: false, message: `kill ${srv.pid} needs approval` };
      get().log(source, `approved kill ${srv.pid} · free :${port}`, "ok");
      bridge.send({ type: "process.kill", pid: srv.pid, approved: true });
      return { ok: true, message: `SAMPLE · kill ${srv.pid} sent · :${port} freeing` };
    },

    startServer: (serverId, source = "touch") => {
      const srv = get().servers.find((x) => x.id === serverId);
      if (!srv) return;
      get().log(source, `start ${srv.repo ?? srv.command} on :${srv.port}`, "ok");
      bridge.send({ type: "server.start", serverId });
      if (srv.sessionId) set({ selectedId: srv.sessionId });
    },

    dispatch: (raw, source = "touch") => {
      const task = raw.trim();
      if (!task) return;
      const { dispatchRepo: repo, dispatchAgent: agent } = get();
      set({ followNewAgent: true });
      get().log(source, `dispatched ${repo}/${agent} · “${task}”`, "ok");
      bridge.send({ type: "agent.dispatch", repo, agent, task });
    },

    cycleDispatchRepo: () => {
      const i = MOCK_REPOS.indexOf(get().dispatchRepo);
      set({ dispatchRepo: MOCK_REPOS[(i + 1) % MOCK_REPOS.length] });
    },
    cycleDispatchAgent: () => set({ dispatchAgent: get().dispatchAgent === "cursor" ? "codex" : "cursor" }),

    resumeSessions: (source = "touch") => {
      get().log(source, "resume sessions · reattach terminals", "ok");
      set({ handoffOpen: false });
      bridge.send({ type: "sessions.resume" });
    },

    toggleSentry: (id) => set({ sentryOpen: get().sentryOpen === id ? null : id }),

    runTests: (repo, source = "touch") => {
      const agent = get().agents.find((a) => a.repo === repo);
      get().log(source, `run ${repo} tests`, "ok");
      if (agent) set({ selectedId: agent.sessionId });
      bridge.send({ type: "tests.run", repo });
    },

    reviewDiff: (agentId, source = "touch") => {
      const a = get().agents.find((x) => x.id === agentId);
      if (!a) return;
      set({ selectedId: a.sessionId });
      get().log(source, `review diff · ${a.repo}/${a.agent}`, "info");
      echo(a.sessionId, promptFor(a.sessionId) + "git diff --stat");
      bridge.send({ type: "term.exec", sessionId: a.sessionId, command: "git diff --stat", approved: false });
    },
  };
});

bridge.subscribe((ev) => useDevStore.getState().apply(ev));

/* ------------------------------------------------------------------------- */
/* Selectors                                                                  */
/* ------------------------------------------------------------------------- */

export const selectedAgent = (s: DevState): AgentSession | undefined => s.agents.find((a) => a.sessionId === s.selectedId);

/** Worst state across the dev workspace, for the core's Dev sector + rail tick. */
export function devAttention(s: Pick<DevState, "agents" | "ci" | "pending">): Attention | null {
  const failed = s.agents.filter((a) => a.state === "failed").length;
  const waiting = s.agents.filter((a) => a.state === "waiting").length + (s.pending ? 1 : 0);
  const ciFailed = s.ci.some((r) => r.status === "failed");
  if (!failed && !waiting && !ciFailed) return null;
  const parts = [failed && `${failed} failed`, waiting && `${waiting} waiting`, !failed && ciFailed && "ci ✕"].filter(Boolean);
  return { level: failed || ciFailed ? "broken" : "attention", note: parts.join(" · ") };
}
