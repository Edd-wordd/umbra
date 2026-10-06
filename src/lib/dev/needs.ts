import { needsOf, type ServiceAction, type ServiceView } from "./services";
import type { PendingApproval } from "./store";
import type { AgentSession, DevServer, RepoId } from "./types";

/**
 * "Needs you": the only things Edward has to act on, derived from live state
 * (agent states, port holders, held commands, service statuses). Nothing is
 * hand-listed: a quiet world yields an empty list.
 */
export type NeedKind = "held" | "agent-waiting" | "agent-failed" | "port" | "service";

export interface Need {
  key: string;
  kind: NeedKind;
  tone: "attention" | "broken";
  /** Repo, or the pid for an orphan process. */
  who: string;
  /** Glyph code for the source (AG agent, :3000 port, G github…). */
  code: string;
  /** Short state word (WAITING, FAILED, ORPHAN, HELD, …). */
  state: string;
  repo?: RepoId;
  text: string;
  /** Service needs folded into this line because they are about the same failure. */
  folded: { service: string; text: string }[];
  agent?: AgentSession;
  server?: DevServer;
  serviceId?: string;
  action?: ServiceAction;
  sentryId?: string;
}

export interface NeedsInput {
  agents: readonly AgentSession[];
  servers: readonly DevServer[];
  pending: PendingApproval | null;
  /** Session the terminal shows; a command held there is already in front of him. */
  selectedId: string;
  views: Record<string, readonly { adapter: { id: string; label: string; chip: string }; view: ServiceView }[]>;
}

export function deriveNeeds({ agents, servers, pending, selectedId, views }: NeedsInput): Need[] {
  const out: Need[] = [];

  if (pending?.origin === "terminal" && pending.sessionId !== selectedId) {
    const a = agents.find((x) => x.sessionId === pending.sessionId);
    out.push({ key: `held-${pending.id}`, kind: "held", tone: "attention", code: "$", state: "HELD", who: a?.repo ?? "terminal", repo: a?.repo, text: pending.command, folded: [] });
  }

  for (const a of agents) {
    if (a.state === "waiting" && a.prompt)
      out.push({ key: a.id, kind: "agent-waiting", tone: "attention", code: "AG", state: "WAITING", who: a.repo, repo: a.repo, text: `${a.agent} · ${a.prompt.title.toLowerCase()}`, folded: [], agent: a });
  }

  const failedRefs = new Map<string, Need>();
  for (const a of agents) {
    if (a.state !== "failed" || !a.failure) continue;
    const n: Need = {
      key: a.id,
      kind: "agent-failed",
      tone: "broken",
      code: "AG",
      state: "FAILED",
      who: a.repo,
      repo: a.repo,
      text: `${a.agent} · ${a.failure.summary}`,
      folded: [],
      agent: a,
      sentryId: a.failure.sentryId,
    };
    out.push(n);
    for (const r of [a.failure.ciRunId, a.failure.sentryId]) if (r) failedRefs.set(r, n);
  }

  for (const s of servers) {
    if (s.state === "stale" && s.pid)
      out.push({ key: s.id, kind: "port", tone: "attention", code: `:${s.port}`, state: "ORPHAN", who: `pid ${s.pid}`, text: s.command, folded: [], server: s });
  }

  const services: Need[] = [];
  for (const [repo, items] of Object.entries(views)) {
    for (const { adapter, view } of items) {
      needsOf(view).forEach((need, i) => {
        const host = need.refs?.map((r) => failedRefs.get(r)).find(Boolean);
        if (host && host.repo === repo) {
          host.folded.push({ service: adapter.label, text: need.text });
          return;
        }
        services.push({
          key: `${repo}-${adapter.id}-${i}`,
          kind: "service",
          tone: need.tone,
          code: adapter.chip,
          state: need.state ?? (need.tone === "broken" ? "FAILED" : "CHECK"),
          who: repo,
          repo,
          text: need.text,
          folded: [],
          serviceId: adapter.id,
          action: need.action,
        });
      });
    }
  }
  services.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "broken" ? -1 : 1));
  return [...out, ...services];
}
