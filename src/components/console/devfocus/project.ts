import type { AgentSession, DevServer, GitInfo } from "@/lib/dev/types";

/** Running and stale (orphaned / outside Herdr) servers both still answer on their port. */
export const isListening = (x: DevServer) => x.state === "running" || x.state === "stale";

/** The project's port for `localhost:PORT ↗`: a running server first, else a stale one still listening. */
export function listeningPort(servers: DevServer[], repo: string): number | undefined {
  const mine = servers.filter((x) => x.repo === repo);
  return (mine.find((x) => x.state === "running") ?? mine.find(isListening))?.port;
}

/** The agent a project's Herdr jump focuses: blocked first, then working, then the first one. */
export function herdrTarget(agents: AgentSession[]): AgentSession | undefined {
  return agents.find((a) => a.state === "waiting") ?? agents.find((a) => a.state === "failed") ?? agents.find((a) => a.state === "running") ?? agents[0];
}

/** "~3 ↑2" (uncommitted files, unpushed commits, ↓ behind). Empty when clean. */
export function gitShort(g: GitInfo | undefined): string {
  if (!g) return "";
  return [g.uncommitted > 0 && `~${g.uncommitted}`, g.ahead > 0 && `↑${g.ahead}`, (g.behind ?? 0) > 0 && `↓${g.behind}`].filter(Boolean).join(" ");
}

export function gitLong(g: GitInfo): string {
  const parts = [
    g.uncommitted > 0 && `${g.uncommitted} uncommitted`,
    g.ahead > 0 && `${g.ahead} unpushed${g.remote ? "" : " (no remote)"}`,
    (g.behind ?? 0) > 0 && `${g.behind} behind`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "clean";
}

export const agentLabel = (a: AgentSession) => (a.where ? `${a.agent} ${a.where}` : a.agent);
