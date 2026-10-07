"use client";

import { create } from "zustand";
import type { Attention } from "../store";
import type { AgentSession, CiRun, DevEvent, DevRequest, DevServer, DevSnapshot, GitInfo, LiveProject, Ping, RepoId } from "./types";

/**
 * Dev view state: a reducer over the Mac helper's events. There is no sample
 * data. Until the helper's snapshot arrives the view shows a connecting or
 * how-to-start line, and when the link drops everything is cleared again.
 */

export interface HelperStatus {
  /** connecting = asking / opening the socket; off = not configured; down = configured but unreachable. */
  state: "connecting" | "off" | "live" | "down";
  hostname?: string;
  herdr?: string;
  gh?: string;
  error?: string;
}

export const MAX_PINGS = 8;

interface DevData {
  /** True once a helper snapshot has arrived (and the link is still up). */
  live: boolean;
  projects: LiveProject[];
  agents: AgentSession[];
  servers: DevServer[];
  /** Latest CI run per repo. */
  ci: Record<RepoId, CiRun>;
  git: Record<RepoId, GitInfo>;
  /** Newest first, at most MAX_PINGS. */
  pings: Ping[];
}

interface DevState extends DevData {
  helper: HelperStatus;
  /** Project whose drawer is open. */
  expandedProject: RepoId | null;
  attach: (send: (req: DevRequest) => void, snapshot: DevSnapshot) => void;
  detach: () => void;
  setHelper: (h: HelperStatus) => void;
  apply: (ev: DevEvent) => void;
  jump: (to: { kind: "herdr"; sessionId: string } | { kind: "cursor"; repo: RepoId }) => void;
  toggleProject: (repo: RepoId) => void;
}

const EMPTY: DevData = { live: false, projects: [], agents: [], servers: [], ci: {}, git: {}, pings: [] };

const isGit = (v: unknown): v is GitInfo =>
  !!v && typeof v === "object" && typeof (v as GitInfo).uncommitted === "number" && typeof (v as GitInfo).ahead === "number";

function gitOf(services: DevSnapshot["services"] | undefined): Record<RepoId, GitInfo> {
  const out: Record<RepoId, GitInfo> = {};
  for (const [repo, v] of Object.entries(services?.github ?? {})) if (isGit(v)) out[repo] = v;
  return out;
}

function withRun(ci: Record<RepoId, CiRun>, run: CiRun): Record<RepoId, CiRun> {
  const cur = ci[run.repo];
  return cur && cur.id !== run.id && cur.at > run.at ? ci : { ...ci, [run.repo]: run };
}

const fromSnapshot = (s: DevSnapshot): DevData => ({
  live: true,
  projects: s.projects ?? [],
  agents: s.agents ?? [],
  servers: s.servers ?? [],
  ci: (s.ci ?? []).reduce(withRun, {}),
  git: gitOf(s.services),
  pings: [...(s.pings ?? [])].sort((a, b) => b.at - a.at).slice(0, MAX_PINGS),
});

let send: (req: DevRequest) => void = () => {};

export const useDevStore = create<DevState>()((set, get) => ({
  ...EMPTY,
  helper: { state: "connecting" },
  expandedProject: null,

  attach: (fn, snapshot) => {
    send = fn;
    set(fromSnapshot(snapshot));
  },
  detach: () => {
    send = () => {};
    set({ ...EMPTY });
  },
  setHelper: (helper) => set({ helper }),

  apply: (ev) =>
    set((s): Partial<DevState> => {
      switch (ev.type) {
        case "snapshot":
          return fromSnapshot(ev.snapshot);
        case "agent.upsert": {
          const i = s.agents.findIndex((a) => a.id === ev.agent.id);
          return { agents: i < 0 ? [...s.agents, ev.agent] : s.agents.map((a, j) => (j === i ? ev.agent : a)) };
        }
        case "agent.remove":
          return { agents: s.agents.filter((a) => a.id !== ev.agentId) };
        case "servers.set":
          return { servers: ev.servers };
        case "ci.upsert":
          return { ci: withRun(s.ci, ev.run) };
        case "projects.set": {
          const open = ev.projects.some((p) => p.repo === s.expandedProject);
          return { projects: ev.projects, expandedProject: open ? s.expandedProject : null };
        }
        case "service.upsert":
          return ev.service === "github" && isGit(ev.payload) ? { git: { ...s.git, [ev.repo]: ev.payload } } : {};
        case "ping":
          return { pings: [ev.ping, ...s.pings.filter((p) => p.id !== ev.ping.id)].slice(0, MAX_PINGS) };
        default:
          return {};
      }
    }),

  jump: (to) => send({ type: "jump", ...to }),
  toggleProject: (repo) => set({ expandedProject: get().expandedProject === repo ? null : repo }),
}));

/** Core sector + DEV tick: a blocked agent = amber, a failed agent or failed CI = red. */
export function devAttention(s: Pick<DevData, "agents" | "ci">): Attention | null {
  const failed = s.agents.filter((a) => a.state === "failed").length;
  const waiting = s.agents.filter((a) => a.state === "waiting").length;
  const ciFailed = Object.values(s.ci).filter((r) => r.status === "failed").length;
  if (!failed && !waiting && !ciFailed) return null;
  const parts = [failed && `${failed} failed`, waiting && `${waiting} blocked`, ciFailed && `ci ✕${ciFailed > 1 ? ciFailed : ""}`].filter(Boolean);
  return { level: failed || ciFailed ? "broken" : "attention", note: parts.join(" · ") };
}
