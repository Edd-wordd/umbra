import { PROJECTS } from "../dev/projects";
import type { AgentSession, CiRun, DevServer, DevSnapshot, RepoId } from "../dev/types";
import { agentId, processId, projectId, repoId, serviceId, sessionId } from "./ids";
import type { BrainEdge, BrainGraph, BrainNode, BrainStatus } from "./types";

const repoProjectId = (repo: RepoId) => projectId(repo);
const repoNodeId = (repo: RepoId, path?: string) => repoId(path ?? repo);

export function devSnapshotToBrainGraph(snapshot: DevSnapshot, now = Date.now()): BrainGraph {
  const nodes: BrainNode[] = [];
  const edges: BrainEdge[] = [];
  const projects = snapshot.projects?.length
    ? snapshot.projects.map((project) => ({ repo: project.repo, path: project.path, services: project.services }))
    : PROJECTS;

  for (const project of projects) {
    const projectNode = repoProjectId(project.repo);
    const repoNode = repoNodeId(project.repo, project.path);

    nodes.push({
      id: projectNode,
      type: "project",
      label: project.repo,
      domain: "dev",
      status: projectStatus(snapshot, project.repo),
      source: "dev",
      updatedAt: now,
      meta: { repo: project.repo, path: project.path },
    });
    nodes.push({
      id: repoNode,
      type: "repo",
      label: project.repo,
      domain: "dev",
      status: projectStatus(snapshot, project.repo),
      source: "dev",
      updatedAt: now,
      meta: { path: project.path },
    });
    edges.push({ from: projectNode, to: repoNode, type: "owns", source: "dev", updatedAt: now });

    for (const service of project.services) {
      const id = serviceId(service, project.repo);
      nodes.push({ id, type: "service", label: `${service} · ${project.repo}`, domain: "dev", status: "watch", source: "dev", updatedAt: now, meta: { service, repo: project.repo } });
      edges.push({ from: projectNode, to: id, type: "uses", source: "dev", updatedAt: now });
    }
  }

  for (const agent of snapshot.agents) addAgent(nodes, edges, agent, now);
  for (const server of snapshot.servers) addServer(nodes, edges, server, now);
  for (const ci of snapshot.ci) addCi(nodes, edges, ci, now);

  return { nodes, edges };
}

function addAgent(nodes: BrainNode[], edges: BrainEdge[], agent: AgentSession, now: number) {
  const id = agentId(agent.agent, agent.id);
  const repoNode = repoNodeId(agent.repo, agent.cwd);
  const termNode = sessionId("dev", agent.sessionId);
  nodes.push({
    id,
    type: "agent",
    label: `${agent.agent} · ${agent.repo}`,
    domain: "dev",
    status: agentStatus(agent.state),
    source: "dev",
    updatedAt: now,
    meta: { repo: agent.repo, branch: agent.branch, task: agent.task, state: agent.state },
  });
  nodes.push({ id: termNode, type: "session", label: agent.sessionId, domain: "dev", status: agentStatus(agent.state), source: "dev", updatedAt: now, meta: { repo: agent.repo } });
  edges.push({ from: id, to: repoNode, type: "assigned_to", source: "dev", updatedAt: now });
  edges.push({ from: id, to: termNode, type: "runs", source: "dev", updatedAt: now });
}

function addServer(nodes: BrainNode[], edges: BrainEdge[], server: DevServer, now: number) {
  const id = server.pid ? processId(server.pid) : processId(server.id);
  nodes.push({
    id,
    type: "process",
    label: `:${server.port} ${server.command}`,
    domain: "dev",
    status: serverStatus(server.state),
    source: "dev",
    updatedAt: now,
    meta: { port: server.port, command: server.command, pid: server.pid ?? null, state: server.state },
  });
  if (server.repo) edges.push({ from: repoNodeId(server.repo), to: id, type: "runs", source: "dev", updatedAt: now });
  if (server.sessionId) edges.push({ from: sessionId("dev", server.sessionId), to: id, type: "runs", source: "dev", updatedAt: now });
}

function addCi(nodes: BrainNode[], edges: BrainEdge[], ci: CiRun, now: number) {
  const id = serviceId("ci", ci.id);
  nodes.push({
    id,
    type: "job",
    label: `CI #${ci.number} · ${ci.repo}`,
    domain: "dev",
    status: ci.status === "failed" ? "blocked" : ci.status === "running" ? "watch" : "silent",
    source: "dev",
    updatedAt: now,
    meta: { repo: ci.repo, branch: ci.branch, status: ci.status, summary: ci.summary },
  });
  edges.push({ from: repoNodeId(ci.repo), to: id, type: "triggered", source: "dev", updatedAt: now });
}

function projectStatus(snapshot: DevSnapshot, repo: RepoId): BrainStatus {
  if (snapshot.agents.some((agent) => agent.repo === repo && agent.state === "waiting")) return "approval";
  if (snapshot.agents.some((agent) => agent.repo === repo && agent.state === "failed")) return "blocked";
  if (snapshot.ci.some((ci) => ci.repo === repo && ci.status === "failed")) return "blocked";
  if (snapshot.servers.some((server) => server.repo === repo && server.state === "stale")) return "actionable";
  if (snapshot.agents.some((agent) => agent.repo === repo && agent.state === "running")) return "watch";
  return "silent";
}

function agentStatus(state: AgentSession["state"]): BrainStatus {
  if (state === "waiting") return "approval";
  if (state === "failed") return "blocked";
  if (state === "running") return "watch";
  if (state === "done") return "fyi";
  return "silent";
}

function serverStatus(state: DevServer["state"]): BrainStatus {
  if (state === "stale") return "actionable";
  if (state === "running" || state === "starting") return "watch";
  return "silent";
}
