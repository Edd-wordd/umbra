import type { BrainEdge, BrainGraph, BrainNode } from "../brain/types";
import type { LabBackup, LabService, LabSnapshot } from "../lab/types";
import type { Situation } from "../situations/types";
import type { DomainAdapter } from "./types";

export const LAB_DOMAIN_ADAPTER: DomainAdapter<LabSnapshot> = {
  id: "lab",
  label: "Lab / Network",
  toGraph: labSnapshotToGraph,
  deriveSituations: deriveLabSituations,
};

function labSnapshotToGraph(snapshot: LabSnapshot, now: number): BrainGraph {
  const nodes: BrainNode[] = [];
  const edges: BrainEdge[] = [];

  for (const host of snapshot.hosts) {
    nodes.push({
      id: host.id,
      type: "device",
      label: host.label,
      domain: "lab",
      status: host.status === "healthy" ? "silent" : host.status === "down" ? "blocked" : "watch",
      source: "lab",
      updatedAt: now,
      meta: { kind: host.kind, cpuPct: host.cpuPct ?? null, memPct: host.memPct ?? null, diskPct: host.diskPct ?? null, url: host.url ?? null },
    });
  }

  for (const service of snapshot.services) addService(nodes, edges, service, now);
  for (const backup of snapshot.backups) addBackup(nodes, edges, backup, now);

  return { nodes, edges };
}

function addService(nodes: BrainNode[], edges: BrainEdge[], service: LabService, now: number) {
  nodes.push({
    id: service.id,
    type: "service",
    label: service.label,
    domain: "lab",
    status: service.status === "running" ? "silent" : service.status === "restarting" || service.status === "attention" ? "watch" : "blocked",
    source: "lab",
    updatedAt: now,
    meta: { kind: service.kind, status: service.status, url: service.url ?? null, restarts: service.restarts ?? 0 },
  });
  edges.push({ from: service.hostId, to: service.id, type: "hosts", source: "lab", updatedAt: now });
}

function addBackup(nodes: BrainNode[], edges: BrainEdge[], backup: LabBackup, now: number) {
  nodes.push({
    id: backup.id,
    type: "job",
    label: backup.label,
    domain: "lab",
    status: backup.status === "current" ? "silent" : backup.status === "stale" ? "actionable" : "blocked",
    source: "lab",
    updatedAt: now,
    meta: { status: backup.status, lastAt: backup.lastAt },
  });
  edges.push({ from: backup.targetId, to: backup.id, type: "depends_on", source: "lab", updatedAt: now });
}

function deriveLabSituations(graph: BrainGraph, _snapshot: LabSnapshot, now: number): Situation[] {
  const situations: Situation[] = [];
  for (const node of graph.nodes) {
    if (node.domain !== "lab") continue;
    if (node.type === "service" && node.meta?.status === "restarting") {
      situations.push(baseLabSituation("container_restart_loop", `${node.label} restarting`, `${node.label} restarted ${node.meta.restarts ?? "multiple"} times`, [node.id], now));
    }
    if (node.type === "job" && node.status === "actionable") {
      situations.push(baseLabSituation("backup_stale", `${node.label} stale`, `${node.label} is stale and should be checked`, [node.id], now));
    }
    if (node.type === "device" && node.status === "blocked") {
      situations.push(baseLabSituation("service_down", `${node.label} down`, `${node.label} is unreachable`, [node.id], now));
    }
  }
  return situations;
}

function baseLabSituation(type: Situation["type"], title: string, whyNow: string, entities: string[], now: number): Situation {
  return {
    id: `situation:lab:${type}:${entities.join("+")}`,
    type,
    title,
    status: "active",
    severity: type === "container_restart_loop" ? "actionable" : "watch",
    confidence: 0.8,
    entities,
    signals: [],
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
    summary: title,
    whyNow,
    suggestedActions: [
      { id: "lab.service.open", label: "Open service", risk: "read" },
      { id: "lab.service.restart", label: "Prepare restart", risk: "local-risky" },
      { id: "lab.backup.check", label: "Check backup", risk: "read" },
    ],
    needsHuman: true,
  };
}
