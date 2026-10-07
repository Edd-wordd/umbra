import type { AgentState, CiStatus } from "./types";

export type DevTone = "active" | "attention" | "broken" | "mid" | "dim";

export const AGENT_TONE: Record<AgentState, DevTone> = {
  running: "active",
  waiting: "attention",
  failed: "broken",
  idle: "dim",
  done: "dim",
  stopped: "dim",
};

export const AGENT_WORD: Record<AgentState, string> = {
  running: "working",
  waiting: "blocked",
  failed: "failed",
  idle: "idle",
  done: "done",
  stopped: "stopped",
};

export const CI_TONE: Record<CiStatus, DevTone> = { passed: "dim", failed: "broken", running: "active", cancelled: "dim" };

/** "now", "4m", "3h", "2d". */
export function formatAge(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 45) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
