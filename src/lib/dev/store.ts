"use client";

import { create } from "zustand";
import { createDevSnapshot, createMockDevBridge, MOCK_AGENT_KINDS, type MockVariant } from "../mock/dev";
import type { Attention } from "../store";
import { shortCwd } from "./format";
import { PROJECTS, type DevProject } from "./projects";
import { getService } from "./services";
import { classifyCommand } from "./risk";
import type { DevSignal } from "./signals";
import type {
  ActivityEntry,
  ActivityResult,
  ActivitySource,
  AgentKind,
  AgentSession,
  DevBridge,
  DevEvent,
  DevSnapshot,
  RecentProject,
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
  origin: "terminal" | "ports" | "fix";
  /** For origin "fix": the triaged signal this one-action fix resolves. */
  signalId?: string;
  /** Exactly what will run once approved. */
  command: string;
  reason: string;
  source: ActivitySource;
  sessionId?: string;
  /** When set, approval runs this tool from the shared tool layer. */
  toolId?: string;
  args?: Record<string, string>;
}

/** Mac helper connection, mirrored in the top bar ("mac") and the Dev header tag. */
export interface HelperStatus {
  /** off = not configured · connecting · live · down = configured but unreachable */
  state: "off" | "connecting" | "live" | "down";
  hostname?: string;
  pty?: string;
  gh?: string;
  herdr?: string;
  error?: string;
}

interface DevState extends DevSnapshot {
  /** Which sample world is loaded (`?mock=quiet` = a good day). */
  mock: MockVariant;
  /** "live" while the Mac helper bridge is attached; "mock" = sample data. */
  bridgeMode: "mock" | "live";
  helper: HelperStatus;
  /** Agents "send to agent" can start (live: from the helper config). */
  agentKinds: AgentKind[];
  /** Terminal session shown on the right; "" = none (the terminal only appears on demand). */
  selectedId: string;
  pending: PendingApproval | null;
  /** "Where you left off" card: shown on the first open, folds after the first interaction or 30 s. */
  handoffOpen: boolean;
  /** Bumped to focus the one-line "send to agent" input (⌘K). */
  dispatchFocusAt: number;
  /** Per-project config (which services each repo uses); "+ service" edits it locally. Live: the repos open in Herdr. */
  projects: DevProject[];
  /** Live: projects whose Herdr workspaces closed recently. */
  recentProjects: RecentProject[];
  /** Project whose service details are open under the terminal. */
  expandedProject: RepoId | null;
  /** Project whose "+ service" picker is open. */
  pickerFor: RepoId | null;
  activity: ActivityEntry[];
  /** Streamed events awaiting triage / triaged (newest first, capped). */
  signals: DevSignal[];
  dispatchRepo: RepoId;
  dispatchAgent: AgentKind;
  /** Select the next agent the bridge creates (set by dispatch). */
  followNewAgent: boolean;

  apply: (ev: DevEvent) => void;
  loadMock: (variant: MockVariant) => void;
  /** Swap in the live helper bridge with its first snapshot. */
  attachBridge: (bridge: DevBridge, snapshot: DevSnapshot, label: string) => void;
  /** Helper went away: back to the sample bridge. */
  detachBridge: (why: string) => void;
  setHelper: (helper: HelperStatus) => void;
  startShell: (repo: RepoId, source?: ActivitySource) => void;
  /** Live: bring this pane to the front in Herdr. */
  focusPane: (sessionId: string, source?: ActivitySource) => void;
  closeTerminal: () => void;
  setHandoff: (open: boolean) => void;
  focusDispatch: () => void;
  dismissSignal: (id: string, source?: ActivitySource) => void;
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
  toggleProject: (repo: RepoId) => void;
  openPicker: (repo: RepoId | null) => void;
  addService: (repo: RepoId, serviceId: string, source?: ActivitySource) => void;
  detachService: (repo: RepoId, serviceId: string, source?: ActivitySource) => void;
  runTests: (repo: RepoId, source?: ActivitySource) => void;
  reviewDiff: (agentId: string, source?: ActivitySource) => void;
}

let n = 0;
const nid = (p: string) => `${p}${(++n).toString(36)}`;
const MAX_LOG = 60;
const MAX_SIGNALS = 40;

const initial = createDevSnapshot(Date.now());
let bridge: DevBridge = createMockDevBridge(initial);
let unsubscribe = () => {};

const seedActivity = (variant: MockVariant): ActivityEntry[] =>
  variant === "quiet"
    ? [{ id: nid("x"), at: Date.now() - 140_000, source: "bridge", text: "sample bridge attached · 1 agent · 1 port · quiet day", result: "info" }]
    : [
        { id: nid("x"), at: Date.now() - 140_000, source: "bridge", text: "sample bridge attached · 4 agents · 3 ports", result: "info" },
        { id: nid("x"), at: Date.now() - 135_000, source: "agent", text: "umbra/cursor waiting · workspace trust", result: "pending" },
      ];

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
    mock: "default",
    selectedId: "",
    pending: null,
    handoffOpen: true,
    dispatchFocusAt: 0,
    projects: PROJECTS.map((p) => ({ ...p, services: [...p.services] })),
    recentProjects: [],
    expandedProject: null,
    pickerFor: null,
    activity: seedActivity("default"),
    signals: [],
    dispatchRepo: "deadbridge-site",
    dispatchAgent: "codex",
    followNewAgent: false,
    bridgeMode: "mock",
    helper: { state: "off" },
    agentKinds: [...MOCK_AGENT_KINDS],

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
            return {
              servers: s.servers.some((x) => x.id === ev.server.id) ? s.servers.map((x) => (x.id === ev.server.id ? ev.server : x)) : [...s.servers, ev.server],
            };
          case "servers.set":
            return { servers: ev.servers };
          case "agent.remove":
            return { agents: s.agents.filter((a) => a.id !== ev.agentId) };
          case "projects.set": {
            // Keep services attached locally with "+ service" for projects that stay open.
            const projects = ev.projects.map((p) => {
              const prev = s.projects.find((x) => x.repo === p.repo);
              return { ...p, services: prev ? [...new Set([...p.services, ...prev.services])] : [...p.services] };
            });
            const repos = new Set(projects.map((p) => p.repo));
            return {
              projects,
              recentProjects: ev.recent,
              expandedProject: s.expandedProject && repos.has(s.expandedProject) ? s.expandedProject : null,
              pickerFor: s.pickerFor && repos.has(s.pickerFor) ? s.pickerFor : null,
              dispatchRepo: repos.has(s.dispatchRepo) ? s.dispatchRepo : (projects[0]?.repo ?? s.dispatchRepo),
            };
          }
          case "ci.upsert":
            return {
              ci: s.ci.some((r) => r.repo === ev.run.repo)
                ? s.ci.map((r) => (r.repo === ev.run.repo ? ev.run : r))
                : [ev.run, ...s.ci],
            };
          case "service.upsert":
            return { services: { ...s.services, [ev.service]: { ...s.services[ev.service], [ev.repo]: ev.payload } } };
          case "signal":
            return { signals: [ev.signal, ...s.signals.filter((x) => x.id !== ev.signal.id)].slice(0, MAX_SIGNALS) };
          case "notice":
            return {
              activity: [...s.activity, { id: nid("x"), at: Date.now(), source: "bridge" as const, text: ev.text, result: ev.result }].slice(-MAX_LOG),
            };
        }
      }),

    loadMock: (variant) => {
      if (variant === get().mock && get().bridgeMode === "mock") return;
      unsubscribe();
      const snap = createDevSnapshot(Date.now(), variant);
      bridge = createMockDevBridge(snap);
      unsubscribe = bridge.subscribe((ev) => get().apply(ev));
      set({
        ...snap,
        mock: variant,
        bridgeMode: "mock",
        agentKinds: [...MOCK_AGENT_KINDS],
        dispatchRepo: "deadbridge-site",
        dispatchAgent: "codex",
        selectedId: "",
        pending: null,
        handoffOpen: true,
        expandedProject: null,
        pickerFor: null,
        projects: PROJECTS.map((p) => ({ ...p, services: [...p.services] })),
        recentProjects: [],
        activity: seedActivity(variant),
        signals: [],
      });
    },

    attachBridge: (live, snap, label) => {
      unsubscribe();
      bridge = live;
      unsubscribe = bridge.subscribe((ev) => get().apply(ev));
      const projects = snap.projects?.map((p) => ({ ...p, services: [...p.services] })) ?? get().projects;
      const kinds = snap.agentKinds?.length ? snap.agentKinds : get().agentKinds;
      set({
        ...snap,
        projects,
        recentProjects: snap.recentProjects ?? [],
        agentKinds: kinds,
        mock: "default",
        bridgeMode: "live",
        selectedId: "",
        pending: null,
        handoffOpen: true,
        expandedProject: null,
        pickerFor: null,
        signals: [],
        dispatchRepo: projects.some((p) => p.repo === get().dispatchRepo) ? get().dispatchRepo : (projects[0]?.repo ?? get().dispatchRepo),
        dispatchAgent: kinds.includes(get().dispatchAgent) ? get().dispatchAgent : kinds[0],
        // Sample-world entries would read as real history: start the log fresh.
        activity: [{ id: nid("x"), at: Date.now(), source: "bridge" as const, text: `mac helper connected · ${label}`, result: "ok" as const }],
      });
    },

    detachBridge: (why) => {
      if (get().bridgeMode !== "live") return;
      set({ mock: "quiet" }); // force loadMock("default") to rebuild
      get().loadMock("default");
      get().log("bridge", `mac helper disconnected · ${why} · showing sample data`, "error");
    },

    setHelper: (helper) => set({ helper }),

    startShell: (repo, source = "touch") => {
      const sessionId = nid("sh-");
      get().log(source, `open shell · ${repo}`, "ok");
      bridge.send({ type: "session.start", repo, kind: "shell", sessionId });
      set({ selectedId: sessionId });
    },

    focusPane: (sessionId, source = "touch") => {
      get().log(source, `focus in Herdr · ${sessionLabel(get(), sessionId)}`, "ok");
      bridge.send({ type: "pane.focus", sessionId });
    },

    closeTerminal: () => get().select(""),
    setHandoff: (handoffOpen) => set({ handoffOpen }),
    focusDispatch: () => set({ dispatchFocusAt: Date.now() }),

    dismissSignal: (id, source = "touch") => {
      const sig = get().signals.find((x) => x.id === id);
      if (!sig) return;
      set({ signals: get().signals.filter((x) => x.id !== id) });
      get().log(source, `dismissed ${sig.repo ?? sig.source} · ${sig.title}`, "info");
    },

    log: (source, text, result = "ok") =>
      set((s) => ({ activity: [...s.activity, { id: nid("x"), at: Date.now(), source, text, result }].slice(-MAX_LOG) })),

    select: (selectedId) => {
      const prev = get().selectedId;
      if (prev === selectedId) return;
      set({ selectedId });
      // Live: Herdr panes are read on demand, only while on screen.
      if (get().bridgeMode === "live") {
        if (prev.startsWith("pane:")) bridge.send({ type: "term.watch", sessionId: prev, on: false });
        if (selectedId.startsWith("pane:")) bridge.send({ type: "term.watch", sessionId: selectedId, on: true });
      }
    },

    runCommand: (raw, source = "touch") => {
      const command = raw.trim();
      if (!command) return;
      const s = get();
      const sessionId = s.selectedId;
      const live = s.bridgeMode === "live";
      // Live sessions echo through their own TTY; the sample shell needs a local echo.
      if (!live) echo(sessionId, promptFor(sessionId) + command);
      if (s.pending) {
        echo(sessionId, "… one approval at a time · resolve the held action first", "dim");
        return;
      }
      if (live && s.sessions[sessionId]?.managed === false) {
        echo(sessionId, "✕ read-only · this process isn't in Herdr or started from Umbra · open a shell from the project", "dim");
        return;
      }
      const target = s.agents.find((a) => a.sessionId === sessionId);
      if (live && target?.state === "waiting") {
        echo(sessionId, "… the agent is waiting on a dialog · answer it with Approve / Deny first", "dim");
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
      get().select(a.sessionId);
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
      if (!srv?.pid) {
        // Sample world: streamed port events have no process behind them.
        if (approved) get().log(source, `:${port} already free · nothing to kill (sample)`, "info");
        return { ok: approved, message: `:${port} has no process` };
      }
      if (!approved) return { ok: false, message: `kill ${srv.pid} needs approval` };
      get().log(source, `approved kill ${srv.pid} · free :${port}`, "ok");
      bridge.send({ type: "process.kill", pid: srv.pid, approved: true });
      return { ok: true, message: `${get().bridgeMode === "live" ? "LIVE" : "SAMPLE"} · kill ${srv.pid} sent · :${port} freeing` };
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
      get().log(source, `dispatched ${repo}/${agent} · “${task}”`, "ok");
      if (get().bridgeMode === "live") {
        // Herdr: the task goes to an idle agent already open in that project; follow it.
        const ready = get().agents.find((a) => a.repo === repo && a.agent === agent && (a.state === "idle" || a.state === "done"));
        if (ready) get().select(ready.sessionId);
      } else set({ followNewAgent: true });
      bridge.send({ type: "agent.dispatch", repo, agent, task });
    },

    cycleDispatchRepo: () => {
      const repos = get().projects.map((p) => p.repo);
      const i = repos.indexOf(get().dispatchRepo);
      set({ dispatchRepo: repos[(i + 1) % repos.length] ?? get().dispatchRepo });
    },
    cycleDispatchAgent: () => {
      const kinds = get().agentKinds;
      set({ dispatchAgent: kinds[(kinds.indexOf(get().dispatchAgent) + 1) % kinds.length] ?? get().dispatchAgent });
    },

    resumeSessions: (source = "touch") => {
      get().log(source, "resume sessions · reattach terminals", "ok");
      set({ handoffOpen: false });
      bridge.send({ type: "sessions.resume" });
    },

    toggleProject: (repo) => set({ expandedProject: get().expandedProject === repo ? null : repo, pickerFor: null }),

    openPicker: (pickerFor) => set({ pickerFor }),

    addService: (repo, serviceId, source = "touch") => {
      const p = get().projects.find((x) => x.repo === repo);
      if (!p || p.services.includes(serviceId) || !getService(serviceId)) return;
      const connected = get().services[serviceId]?.[repo] !== undefined;
      set({
        projects: get().projects.map((x) => (x.repo === repo ? { ...x, services: [...x.services, serviceId] } : x)),
        pickerFor: null,
        expandedProject: repo,
      });
      get().log(source, `attached ${serviceId} → ${repo}${connected ? "" : " · not connected yet (sample)"}`, "ok");
    },

    detachService: (repo, serviceId, source = "touch") => {
      set({ projects: get().projects.map((x) => (x.repo === repo ? { ...x, services: x.services.filter((id) => id !== serviceId) } : x)) });
      get().log(source, `detached ${serviceId} from ${repo}`, "info");
    },

    runTests: (repo, source = "touch") => {
      const agent = get().agents.find((a) => a.repo === repo);
      get().log(source, `run ${repo} tests`, "ok");
      if (agent && get().bridgeMode !== "live") set({ selectedId: agent.sessionId });
      bridge.send({ type: "tests.run", repo });
    },

    reviewDiff: (agentId, source = "touch") => {
      const a = get().agents.find((x) => x.id === agentId);
      if (!a) return;
      get().select(a.sessionId);
      get().log(source, `review diff · ${a.repo}/${a.agent}`, "info");
      // A Herdr pane hosts the agent itself: typing there would prompt it, not run git.
      if (a.sessionId.startsWith("pane:")) return;
      echo(a.sessionId, promptFor(a.sessionId) + "git diff --stat");
      bridge.send({ type: "term.exec", sessionId: a.sessionId, command: "git diff --stat", approved: false });
    },
  };
});

unsubscribe = bridge.subscribe((ev) => useDevStore.getState().apply(ev));

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
