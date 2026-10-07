import type { Need } from "./needs";
import type { RepoId } from "./types";

/**
 * Dev signals: everything that might deserve Edward's attention, as plain
 * JSON the decision layer can triage. Two sources:
 *  - state-derived: today's Needs-you derivation (agents, ports, service
 *    adapter flags) converted 1:1, so adapter flags stay the *input*
 *  - streamed: discrete events from the bridge (sample: `?mock=events`)
 *
 * Facts are pre-computed in code (counts, "more than a day"): Jev judges,
 * code does arithmetic and dates.
 */
export type SignalKind =
  | "ci.failed"
  | "agent.waiting"
  | "agent.failed"
  | "agent.done"
  | "container.restarts"
  | "sentry.spike"
  | "lead.new"
  | "unpushed.stale"
  | "posthog.spike"
  | "deps.update"
  | "port.stale"
  | "service";

export interface SignalFix {
  label: string;
  toolId: string;
  args?: Record<string, string>;
}

export interface DevSignal {
  /** Stable id; decisions are cached per id. */
  id: string;
  at: number;
  kind: SignalKind;
  /** github, sentry, docker, posthog, frappe, agent, ports… */
  source: string;
  repo?: RepoId;
  /** Short line as shown in the list. */
  title: string;
  detail?: string;
  /** What the source itself says (input state, not the decision). */
  tone: "broken" | "attention" | "info";
  facts?: Record<string, string | number | boolean>;
  /** One reversible action Umbra could take (shown when Jev thinks it can self-fix). */
  fix?: SignalFix;
  /** The Needs-you row this came from (state-derived signals only). */
  needKey?: string;
}

/** Signal kinds that are blocked on Edward by definition (code policy, not a judgment). */
export const BLOCKED_ON_EDWARD: ReadonlySet<SignalKind> = new Set(["agent.waiting"]);

/** Short stable hash so a changed need (new prompt, new failure) gets a fresh decision. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Today's derived needs as signals (held terminal commands stay pinned; they are his own pending yes). */
export function signalsFromNeeds(needs: readonly Need[]): DevSignal[] {
  const out: DevSignal[] = [];
  for (const n of needs) {
    const base = { id: `need:${n.key}:${hash(n.text)}`, at: 0, repo: n.repo, needKey: n.key, tone: n.tone } as const;
    switch (n.kind) {
      case "held":
        break;
      case "agent-waiting":
        out.push({
          ...base,
          kind: "agent.waiting",
          source: "agent",
          title: n.text,
          detail: n.agent?.prompt?.detail,
          facts: { agent: n.agent?.agent ?? "agent", prompt: n.agent?.prompt?.title ?? "", blocked_until_answered: true },
        });
        break;
      case "agent-failed":
        out.push({
          ...base,
          kind: "agent.failed",
          source: "agent",
          title: n.text,
          detail: n.agent?.failure?.summary,
          facts: {
            agent: n.agent?.agent ?? "agent",
            failing_tests: n.agent?.failure?.tests.length ?? 0,
            ci_failed_too: !!n.agent?.failure?.ciRunId,
            linked_sentry_issue: !!n.sentryId,
            branch: n.agent?.branch ?? "",
          },
        });
        break;
      case "port":
        out.push({
          ...base,
          kind: "port.stale",
          source: "ports",
          title: n.text,
          detail: `port ${n.who} held by a process with no live dev session`,
          facts: { port: n.server?.port ?? 0, process: n.server?.command ?? "", owner_session_alive: false },
          fix: n.server ? { label: "FREE", toolId: "dev.port.free", args: { port: String(n.server.port) } } : undefined,
        });
        break;
      case "service":
        out.push({
          ...base,
          kind: "service",
          source: n.serviceId ?? "service",
          title: n.text,
          facts: { source_status: n.tone },
          fix: n.action ? { label: n.action.label, toolId: n.action.toolId, args: n.action.args } : undefined,
        });
        break;
    }
  }
  return out;
}
