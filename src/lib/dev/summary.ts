import { createDevSnapshot } from "../mock/dev";

export type DevSummaryStatus = "silent" | "watch" | "blocked";

export interface DevSummary {
  source: "partial";
  status: DevSummaryStatus;
  needs: number;
  projects: number;
  agents: number;
  servers: number;
  ci: number;
  notes: string[];
}

export function getDevSummary(now = Date.now()): DevSummary {
  const snapshot = createDevSnapshot(now);
  const waitingAgents = snapshot.agents.filter((agent) => agent.state === "waiting").length;
  const failedAgents = snapshot.agents.filter((agent) => agent.state === "failed").length;
  const staleServers = snapshot.servers.filter((server) => server.state === "stale").length;
  const failedCi = snapshot.ci.filter((run) => run.status === "failed").length;
  const needs = waitingAgents + failedAgents + staleServers + failedCi;
  const status: DevSummaryStatus = failedAgents || failedCi || staleServers ? "blocked" : waitingAgents ? "watch" : "silent";
  return {
    source: "partial",
    status,
    needs,
    projects: new Set(snapshot.agents.map((agent) => agent.repo)).size,
    agents: snapshot.agents.length,
    servers: snapshot.servers.length,
    ci: snapshot.ci.length,
    notes: [`${snapshot.agents.length} agents`, `${staleServers} stale servers`, `${failedCi} failed CI`],
  };
}
