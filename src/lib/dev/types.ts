import type { DevSignal } from "./signals";
/**
 * Dev workspace models + the wire protocol the Mac-helper terminal bridge will
 * speak (Phase 2). Today a SAMPLE in-memory bridge (src/lib/mock/dev.ts)
 * implements the same interface, so the UI and store never know the
 * difference.
 *
 * Shape rules: plain JSON (no Dates, no class instances), epoch-ms timestamps,
 * stable string ids. Everything the UI shows is derived from these.
 */
import type { ServicePayloads } from "./services/types";

export type RepoId = "umbra" | "parallax" | "deadbridge-site" | "google" | (string & {});
export type AgentKind = "cursor" | "codex" | "pi" | "claude" | (string & {});

/**
 * running  cyan   agent is working
 * waiting  amber  agent is blocked on you (prompt)
 * idle     gray   ready for input (live: Herdr "idle" / "unknown")
 * done     gray   finished; diff ready for review
 * failed   red    stopped on an error (tests, build)
 * stopped  gray   ended without result (denied, quit)
 */
export type AgentState = "running" | "waiting" | "idle" | "done" | "failed" | "stopped";

export interface AgentPrompt {
  id: string;
  kind: "workspace-trust" | "confirm";
  title: string;
  detail: string;
}

export interface DiffStat {
  files: number;
  additions: number;
  deletions: number;
}

export interface AgentFailure {
  summary: string;
  /** Failing test names, file › describe › it. */
  tests: string[];
  ciRunId?: string;
  sentryId?: string;
}

export interface AgentSession {
  id: string;
  repo: RepoId;
  agent: AgentKind;
  branch: string;
  cwd: string;
  task: string;
  state: AgentState;
  startedAt: number;
  endedAt?: number;
  /** Terminal session that carries this agent's transcript. */
  sessionId: string;
  prompt?: AgentPrompt;
  diff?: DiffStat;
  failure?: AgentFailure;
  /** Live bridge: true = started from Umbra (prompts watched); false = found running on the Mac. */
  managed?: boolean;
  pid?: number;
  note?: string;
}

/** One rendered terminal line. The real bridge sends ANSI chunks; the helper normalises them to lines. */
export type TermLineKind = "cmd" | "out" | "dim" | "ok" | "warn" | "err" | "sys";

export interface TermLine {
  id: string;
  at: number;
  kind: TermLineKind;
  text: string;
}

export interface TermSession {
  id: string;
  title: string;
  cwd: string;
  branch: string;
  lines: TermLine[];
  /** Live bridge: false = read-only placeholder for a process Umbra didn't start. */
  managed?: boolean;
}

export type ServerState = "running" | "starting" | "stale" | "stopped" | "free";

export interface DevServer {
  id: string;
  port: number;
  repo?: RepoId;
  pid?: number;
  command: string;
  state: ServerState;
  sessionId?: string;
  note?: string;
  startedAt?: number;
}

export type CiStatus = "passed" | "failed" | "running" | "cancelled";

export interface CiRun {
  id: string;
  repo: RepoId;
  branch: string;
  number: number;
  status: CiStatus;
  summary: string;
  failing: string[];
  sentryId?: string;
  at: number;
  url?: string;
}

export interface Handoff {
  repo: RepoId;
  branch: string;
  summary: string;
  tone: "mid" | "active" | "attention" | "broken";
}

export interface DevSnapshot {
  agents: AgentSession[];
  sessions: Record<string, TermSession>;
  servers: DevServer[];
  ci: CiRun[];
  /** Per-service, per-repo payloads rendered by the service adapters (src/lib/dev/services). */
  services: ServicePayloads;
  handoff: { at: number; items: Handoff[] };
  /** Live bridge: the projects open in Herdr right now (replaces the built-in project list). */
  projects?: LiveProject[];
  /** Live bridge: projects whose Herdr workspaces closed recently. */
  recentProjects?: RecentProject[];
  /** Live bridge: agents the helper can start. */
  agentKinds?: AgentKind[];
}

/** Herdr's agent status vocabulary (blocked = waiting on Edward). */
export type HerdrStatus = "idle" | "working" | "blocked" | "done" | "unknown";

export interface LiveProject {
  repo: RepoId;
  path: string;
  services: string[];
  /** Herdr workspace label. */
  label?: string;
  /** Herdr workspace ids on this repo (often two). */
  workspaces?: string[];
  agentStatus?: HerdrStatus;
}

export interface RecentProject {
  repo: RepoId;
  path: string;
  label?: string;
  lastSeen: number;
}

/* ------------------------------------------------------------------------- */
/* Wire protocol                                                              */
/* ------------------------------------------------------------------------- */

/** UI -> bridge. Anything risky carries `approved`; the bridge refuses it otherwise. */
export type DevRequest =
  | { type: "term.exec"; sessionId: string; command: string; approved: boolean }
  | { type: "agent.respond"; agentId: string; promptId: string; answer: "approve" | "deny" }
  | { type: "agent.dispatch"; repo: RepoId; agent: AgentKind; task: string }
  | { type: "process.kill"; pid: number; approved: boolean }
  | { type: "server.start"; serverId: string }
  | { type: "tests.run"; repo: RepoId }
  | { type: "sessions.resume" }
  /** Live bridge: open a managed shell in a project (id chosen by the UI so it can select it). */
  | { type: "session.start"; repo: RepoId; kind: "shell"; sessionId?: string }
  /** Live bridge: stream this session's output while it's on screen (Herdr panes are read on demand). */
  | { type: "term.watch"; sessionId: string; on: boolean }
  /** Live bridge: jump to this pane in Herdr. */
  | { type: "pane.focus"; sessionId: string };

/** Bridge -> UI. The store is a pure reducer over these. */
export type DevEvent =
  | { type: "snapshot"; snapshot: DevSnapshot }
  | { type: "agent.upsert"; agent: AgentSession }
  | { type: "session.upsert"; session: Omit<TermSession, "lines">; lines?: TermLine[] }
  | { type: "term.append"; sessionId: string; lines: TermLine[] }
  | { type: "term.clear"; sessionId: string }
  | { type: "server.upsert"; server: DevServer }
  /** Live bridge: the full listening-port list (ports come and go). */
  | { type: "servers.set"; servers: DevServer[] }
  /** Live bridge: Herdr workspaces opened/closed → the project list changed. */
  | { type: "projects.set"; projects: LiveProject[]; recent: RecentProject[] }
  | { type: "agent.remove"; agentId: string }
  | { type: "ci.upsert"; run: CiRun }
  | { type: "service.upsert"; service: string; repo: RepoId; payload: unknown }
  | { type: "notice"; text: string; result: ActivityResult }
  /** A discrete event for the decision layer to triage (CI, Sentry, leads, …). */
  | { type: "signal"; signal: DevSignal };

export interface DevBridge {
  send(req: DevRequest): void;
  subscribe(fn: (ev: DevEvent) => void): () => void;
}

/* ------------------------------------------------------------------------- */
/* Activity log                                                               */
/* ------------------------------------------------------------------------- */

export type ActivitySource = "touch" | "palette" | "voice" | "agent" | "bridge" | "triage";
export type ActivityResult = "ok" | "denied" | "error" | "info" | "pending";

export interface ActivityEntry {
  id: string;
  at: number;
  source: ActivitySource;
  text: string;
  result: ActivityResult;
}
