/**
 * Wire protocol between the helper and the Umbra app. This mirrors the
 * bridge interface in src/lib/dev/types.ts (DevEvent / DevRequest / the
 * snapshot models) on purpose, without importing it, so the helper builds
 * on its own. src/lib/dev/helper-protocol.check.ts asserts at typecheck
 * time that the two stay compatible. Keep this file free of imports.
 */

export type RepoId = string;
export type AgentKind = string;
export type AgentState = "running" | "waiting" | "idle" | "done" | "failed" | "stopped";

export interface AgentPrompt {
  id: string;
  kind: "workspace-trust" | "confirm";
  title: string;
  detail: string;
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
  sessionId: string;
  prompt?: AgentPrompt;
  /** true = started from Umbra (prompts are watched); false = found running. */
  managed?: boolean;
  pid?: number;
  note?: string;
}

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
  at: number;
  url?: string;
}

export interface Handoff {
  repo: RepoId;
  branch: string;
  summary: string;
  tone: "mid" | "active" | "attention" | "broken";
}

export interface ProjectInfo {
  repo: RepoId;
  path: string;
  services: string[];
  /** Herdr workspace label (display name). */
  label?: string;
  /** Herdr workspace ids showing this repo (Edward often has two). */
  workspaces?: string[];
  /** Worst Herdr agent status across those workspaces. */
  agentStatus?: "idle" | "working" | "blocked" | "done" | "unknown";
}

export interface RecentProject {
  repo: RepoId;
  path: string;
  label?: string;
  lastSeen: number;
}

/** github service payload (src/lib/dev/services/github.ts GithubPayload). */
export interface GitPayload {
  remote: string | null;
  branch: string;
  uncommitted: number;
  ahead: number;
  behind?: number;
  oldestUnpushedAt?: number;
  staleBranches: { name: string; days: number }[];
  lastCommit: { sha: string; message: string; at: number };
  openPrs: number;
  workflows: boolean;
  ciNote?: string;
}

export interface Snapshot {
  agents: AgentSession[];
  sessions: Record<string, TermSession>;
  servers: DevServer[];
  ci: CiRun[];
  services: Record<string, Partial<Record<RepoId, unknown>>>;
  handoff: { at: number; items: Handoff[] };
  projects?: ProjectInfo[];
  recentProjects?: RecentProject[];
  agentKinds?: AgentKind[];
}

export type ActivityResult = "ok" | "denied" | "error" | "info" | "pending";

/** Helper -> app. */
export type HelperEvent =
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "agent.upsert"; agent: AgentSession }
  | { type: "agent.remove"; agentId: string }
  | { type: "session.upsert"; session: Omit<TermSession, "lines">; lines?: TermLine[] }
  | { type: "term.append"; sessionId: string; lines: TermLine[] }
  | { type: "term.clear"; sessionId: string }
  | { type: "servers.set"; servers: DevServer[] }
  | { type: "projects.set"; projects: ProjectInfo[]; recent: RecentProject[] }
  | { type: "ci.upsert"; run: CiRun }
  | { type: "service.upsert"; service: string; repo: RepoId; payload: unknown }
  | { type: "notice"; text: string; result: ActivityResult };

/** App -> helper. Risky requests also carry `approvalId` (minted via POST /approvals). */
export type HelperRequest =
  | { type: "term.exec"; sessionId: string; command: string; approved: boolean }
  | { type: "agent.respond"; agentId: string; promptId: string; answer: "approve" | "deny" }
  | { type: "agent.dispatch"; repo: RepoId; agent: AgentKind; task: string }
  | { type: "process.kill"; pid: number; approved: boolean }
  | { type: "server.start"; serverId: string }
  | { type: "tests.run"; repo: RepoId }
  | { type: "sessions.resume" }
  | { type: "session.start"; repo: RepoId; kind: "shell"; sessionId?: string }
  /** Stream a session's output while the UI shows it (Herdr panes are read on demand). */
  | { type: "term.watch"; sessionId: string; on: boolean }
  /** Jump to that pane in Herdr. */
  | { type: "pane.focus"; sessionId: string };

export type WireRequest = HelperRequest & { approvalId?: string };
