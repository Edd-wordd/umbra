import type { DevTone } from "../format";
import type { DevProject } from "../projects";
import type { AgentSession, CiRun, DevServer, RepoId } from "../types";

/**
 * Service adapters: one file per external service (GitHub, Sentry, …).
 * An adapter turns that service's bridge payload for ONE project into a
 * small, uniform view. The UI only ever renders ServiceViews, so adding a
 * service never touches the UI.
 */

export type ServiceId = string;

/** ok = healthy & quiet (gray), active = something running (white), attention = amber, broken = red, idle = not connected. */
export type ServiceStatus = "ok" | "active" | "attention" | "broken" | "idle";

export const STATUS_TONE: Record<ServiceStatus, DevTone> = {
  ok: "mid",
  active: "active",
  attention: "attention",
  broken: "broken",
  idle: "dim",
};

const RANK: Record<ServiceStatus, number> = { idle: 0, ok: 1, active: 2, attention: 3, broken: 4 };
export const worstStatus = (xs: readonly ServiceStatus[]): ServiceStatus =>
  xs.reduce<ServiceStatus>((w, s) => (RANK[s] > RANK[w] ? s : w), "idle");

export interface ServiceRow {
  k: string;
  v: string;
  tone?: DevTone;
}

/** Card actions always go through the shared tool layer (read tools only here). */
export interface ServiceAction {
  label: string;
  toolId: string;
  args?: Record<string, string>;
}

/**
 * Something in a service Edward should act on; surfaces under "Needs you".
 * `refs` (CI run id, Sentry issue id, …) let items about the same failure
 * fold into one line (e.g. a failed agent + its CI run + its Sentry issue).
 */
export interface ServiceNeed {
  tone: "attention" | "broken";
  /** One short state word for the key/value row (FAILED, LOCAL, AHEAD…). Defaults from tone. */
  state?: string;
  text: string;
  refs?: string[];
  action?: ServiceAction;
}

export interface ServiceView {
  status: ServiceStatus;
  /**
   * Actionable items. When omitted, an attention/broken status becomes one
   * need from `summary` (unless `fyi`).
   */
  needs?: ServiceNeed[];
  /** Attention worth a chip but nothing to do (e.g. a traffic spike): stays out of "Needs you". */
  fyi?: boolean;
  /** One line: chip tooltip + card header. */
  summary: string;
  rows: ServiceRow[];
  /** Pre-formatted lines (stack trace, log tail). */
  excerpt?: string[];
  /** Tiny trend line (e.g. 7 days of pageviews). */
  spark?: number[];
  actions?: ServiceAction[];
  /** Card spans the full drawer width; `columns: 2` splits its rows. */
  wide?: boolean;
  columns?: 1 | 2;
}

/** Live dev state an adapter may cross-reference (CI runs, servers, agents). */
export interface ServiceContext {
  project: DevProject;
  ci: readonly CiRun[];
  servers: readonly DevServer[];
  agents: readonly AgentSession[];
  now: number;
}

export interface ServiceAdapter<P = unknown> {
  id: ServiceId;
  label: string;
  /** 1–4 char glyph code for its tile (G, S, P, SB, D, F). */
  chip: string;
  /** One line for the "+ service" picker. */
  blurb: string;
  /** `payload` is undefined until the service is configured for this project. */
  read(payload: P | undefined, ctx: ServiceContext): ServiceView;
}

/** Bridge payloads, keyed by service id then repo. Each adapter owns its payload type. */
export type ServicePayloads = Record<ServiceId, Partial<Record<RepoId, unknown>>>;

/** Typed helper so each adapter file reads naturally. */
export const defineService = <P>(a: ServiceAdapter<P>): ServiceAdapter<P> => a;

export const notConnected = (label: string): ServiceView => ({
  status: "idle",
  summary: "attached · not connected",
  rows: [{ k: "setup", v: `${label} credentials go in the bridge config (phase 2)`, tone: "dim" }],
});
