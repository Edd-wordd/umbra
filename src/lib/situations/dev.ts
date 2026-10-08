import { repoId } from "../brain/ids";
import { relatedEdges } from "../brain/graph";
import type { BrainGraph, BrainNode } from "../brain/types";
import type { Situation, SituationType } from "./types";

export function deriveDevSituations(graph: BrainGraph, now = Date.now()): Situation[] {
  const situations: Situation[] = [];
  for (const node of graph.nodes) {
    if (node.domain !== "dev") continue;
    if (node.type === "agent" && node.status === "approval") situations.push(agentSituation(node, "blocked_agent", now));
    if (node.type === "agent" && node.status === "blocked") situations.push(agentSituation(node, "blocked_agent", now));
    if (node.type === "job" && node.status === "blocked") situations.push(ciSituation(node, now));
    if (node.type === "process" && node.status === "actionable") situations.push(stalePortSituation(node, now));
    if (node.type === "service" && node.status === "blocked") situations.push(serviceSituation(node, now));
  }
  return dedupeSituations(groupRepoSituations(graph, situations, now));
}

function agentSituation(node: BrainNode, type: SituationType, now: number): Situation {
  const repo = String(node.meta?.repo ?? "repo");
  const approval = node.status === "approval";
  return baseSituation({
    id: `situation:dev:${type}:${node.id}`,
    type,
    title: approval ? `${repo} agent needs approval` : `${repo} agent blocked`,
    severity: approval ? "approval" : "blocked",
    entities: [node.id],
    summary: String(node.meta?.task ?? node.label),
    whyNow: approval ? `agent waiting · ${node.label} needs Edward's yes` : `agent failed · ${node.label} stopped before resolving task`,
    suggestedActions: approval
      ? [
          { id: "dev.agent.approve", label: "Approve prompt", risk: "local-risky" },
          { id: "dev.agent.deny", label: "Deny prompt", risk: "local-safe" },
        ]
      : [{ id: "dev.sessions.resume", label: "Open agent session", risk: "read" }],
    needsHuman: true,
    now,
  });
}

function ciSituation(node: BrainNode, now: number): Situation {
  const repo = String(node.meta?.repo ?? "repo");
  return baseSituation({
    id: `situation:dev:failed_ci:${node.id}`,
    type: "failed_ci",
    title: `${repo} CI failed`,
    severity: "blocked",
    entities: [node.id],
    summary: String(node.meta?.summary ?? node.label),
    whyNow: `CI failed · ${node.label}`,
    suggestedActions: [
      { id: "dev.ci.open", label: "Open failing run", risk: "read" },
      { id: "dev.ci.rerun", label: "Rerun CI", risk: "external" },
    ],
    needsHuman: true,
    now,
  });
}

function stalePortSituation(node: BrainNode, now: number): Situation {
  const port = String(node.meta?.port ?? "unknown");
  return baseSituation({
    id: `situation:dev:stale_port:${node.id}`,
    type: "stale_port",
    title: `port ${port} may be stale`,
    severity: "actionable",
    entities: [node.id],
    summary: node.label,
    whyNow: `port ${port} is occupied by ${node.meta?.command ?? "a process"}`,
    suggestedActions: [{ id: "dev.port.free", label: `Free port ${port}`, risk: "local-risky" }],
    needsHuman: true,
    now,
  });
}

function serviceSituation(node: BrainNode, now: number): Situation {
  return baseSituation({
    id: `situation:dev:service_attention:${node.id}`,
    type: "service_attention",
    title: `${node.label} needs attention`,
    severity: "blocked",
    entities: [node.id],
    summary: node.label,
    whyNow: `service reports blocked state · ${node.label}`,
    suggestedActions: [{ id: "dev.service.open", label: "Open service detail", risk: "read" }],
    needsHuman: true,
    now,
  });
}

function baseSituation(input: Omit<Situation, "status" | "confidence" | "signals" | "createdAt" | "updatedAt" | "lastSeenAt"> & { now: number }): Situation {
  return {
    id: input.id,
    type: input.type,
    sourceTypes: input.sourceTypes,
    title: input.title,
    status: "active",
    severity: input.severity,
    confidence: 0.8,
    entities: input.entities,
    signals: [],
    createdAt: input.now,
    updatedAt: input.now,
    lastSeenAt: input.now,
    summary: input.summary,
    whyNow: input.whyNow,
    suggestedActions: input.suggestedActions,
    needsHuman: input.needsHuman,
  };
}

function groupRepoSituations(graph: BrainGraph, situations: Situation[], now: number): Situation[] {
  const byRepo = new Map<string, Situation[]>();
  for (const situation of situations) {
    const repo = repoForSituation(graph, situation);
    if (!repo) continue;
    const list = byRepo.get(repo) ?? [];
    list.push(situation);
    byRepo.set(repo, list);
  }

  const grouped: Situation[] = [];
  const consumed = new Set<string>();
  for (const [repo, repoSituations] of byRepo) {
    const hasFailedCi = repoSituations.some((s) => s.type === "failed_ci");
    const hasBlockedAgent = repoSituations.some((s) => s.type === "blocked_agent");
    if (!hasFailedCi || !hasBlockedAgent) continue;
    for (const situation of repoSituations) consumed.add(situation.id);
    grouped.push(
      baseSituation({
        id: `situation:dev:project_blocked:${repo}`,
        type: "project_blocked",
        title: `${repo} work blocked`,
        sourceTypes: [...new Set(repoSituations.map((s) => s.type))],
        severity: "blocked",
        entities: [...new Set(repoSituations.flatMap((s) => s.entities))],
        summary: repoSituations.map((s) => s.summary).join(" · "),
        whyNow: `agent and CI both need attention for ${repo}`,
        suggestedActions: [
          { id: "dev.sessions.resume", label: "Open agent session", risk: "read" },
          { id: "dev.ci.open", label: "Open failing CI", risk: "read" },
        ],
        needsHuman: true,
        now,
      }),
    );
  }

  return [...situations.filter((situation) => !consumed.has(situation.id)), ...grouped];
}

function repoForSituation(graph: BrainGraph, situation: Situation): string | undefined {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const entity of situation.entities) {
    const node = nodeById.get(entity);
    const repo = node?.meta?.repo;
    if (typeof repo === "string") return repo;
    const repoEdge = relatedEdges(graph, entity, "both").find((edge) => nodeById.get(edge.from)?.type === "repo" || nodeById.get(edge.to)?.type === "repo");
    const repoNode = repoEdge ? nodeById.get(repoEdge.from)?.type === "repo" ? nodeById.get(repoEdge.from) : nodeById.get(repoEdge.to) : undefined;
    if (repoNode?.id.startsWith(repoId(""))) return repoNode.label;
  }
  return undefined;
}

function dedupeSituations(situations: Situation[]): Situation[] {
  return [...new Map(situations.map((situation) => [situation.id, situation])).values()];
}
