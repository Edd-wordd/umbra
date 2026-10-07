/**
 * Dev view models: the subset of the Mac helper's wire protocol
 * (helper/src/protocol.ts) the lean Dev view reads. helper-protocol.check.ts
 * keeps the two in step at compile time.
 */

export type RepoId = string;
export type AgentKind = string;

/** Herdr agent_status mapped by the helper: running = working, waiting = blocked. */
export type AgentState = "running" | "waiting" | "idle" | "done" | "failed" | "stopped";
export type HerdrStatus = "idle" | "working" | "blocked" | "done" | "unknown";

export interface AgentSession {
  id: string;
  repo: RepoId;
  agent: AgentKind;
  branch: string;
  task: string;
  state: AgentState;
  /** Herdr pane id: what a Herdr jump focuses. */
  sessionId: string;
  prompt?: { title: string };
  note?: string;
  /** "ws 1" / "ws 6" when a project is open in more than one Herdr workspace. */
  where?: string;
}

export type ServerState = "running" | "starting" | "stale" | "stopped" | "free";
export interface DevServer {
  id: string;
  port: number;
  repo?: RepoId;
  command: string;
  state: ServerState;
  /** e.g. "orphan · parent gone · up 3h". */
  note?: string;
}

export type CiStatus = "passed" | "failed" | "running" | "cancelled";
export interface CiRun {
  id: string;
  repo: RepoId;
  branch: string;
  status: CiStatus;
  summary: string;
  at: number;
  url?: string;
}

export interface GitInfo {
  remote: string | null;
  branch: string;
  uncommitted: number;
  ahead: number;
  behind?: number;
  staleBranches: { name: string; days: number }[];
}

export interface LiveProject {
  repo: RepoId;
  path: string;
  label?: string;
  workspaces?: string[];
  agentStatus?: HerdrStatus;
}

export type PingKind = "agent.blocked" | "agent.done" | "server.died" | "ci.failed" | "work.stale" | "test";
export interface Ping {
  id: string;
  at: number;
  kind: PingKind;
  repo?: RepoId;
  title: string;
  message: string;
  jump?: string;
  target?: "herdr" | "cursor" | "localhost" | "url";
}

export interface DevSnapshot {
  agents: AgentSession[];
  servers: DevServer[];
  ci: CiRun[];
  /** services.github[repo] = git status (the helper's GitPayload). */
  services: Record<string, Partial<Record<RepoId, unknown>>>;
  projects?: LiveProject[];
  pings?: Ping[];
}

/** Helper → app events the Dev view reads; the store ignores every other type. */
export type DevEvent =
  | { type: "snapshot"; snapshot: DevSnapshot }
  | { type: "agent.upsert"; agent: AgentSession }
  | { type: "agent.remove"; agentId: string }
  | { type: "servers.set"; servers: DevServer[] }
  | { type: "ci.upsert"; run: CiRun }
  | { type: "projects.set"; projects: LiveProject[] }
  | { type: "service.upsert"; service: string; repo: RepoId; payload: unknown }
  | { type: "ping"; ping: Ping };

/** App → helper. Jumps only: focus an agent's Herdr pane, or open a project in Cursor. */
export type DevRequest = { type: "jump"; kind: "herdr"; sessionId: string } | { type: "jump"; kind: "cursor"; repo: RepoId };
