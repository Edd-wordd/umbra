import type { AgentState, CiStatus, ServerState } from "./types";

/** zsh-style short path: /Users/me/Documents/codes/projects/umbra -> ~/D/c/p/umbra */
export function shortCwd(cwd: string): string {
  const parts = cwd.replace(/^\/Users\/[^/]+/, "~").split("/");
  return parts.map((p, i) => (i === 0 || i === parts.length - 1 ? p : p.slice(0, 1))).join("/");
}

/** 0:42 · 6:40 · 1h 05m */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Activity palette tone for each state (see DESIGN.md: color only for activity). */
export type DevTone = "active" | "attention" | "broken" | "mid" | "dim";

export const AGENT_TONE: Record<AgentState, DevTone> = {
  running: "active",
  waiting: "attention",
  idle: "mid",
  done: "mid",
  failed: "broken",
  stopped: "dim",
};

export const SERVER_TONE: Record<ServerState, DevTone> = {
  running: "active",
  starting: "active",
  stale: "attention",
  stopped: "dim",
  free: "dim",
};

export const CI_TONE: Record<CiStatus, DevTone> = { passed: "mid", failed: "broken", running: "active", cancelled: "dim" };

/** 40s ago · 18m ago · 3h ago · 6d ago */
export function formatAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
