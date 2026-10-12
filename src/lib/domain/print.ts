import type { BrainEdge, BrainGraph, BrainNode } from "../brain/types";
import type { Situation } from "../situations/types";
import type { PrintImageSet, PrintJob, PrintSnapshot } from "../print/types";
import type { DomainAdapter } from "./types";

export const PRINT_DOMAIN_ADAPTER: DomainAdapter<PrintSnapshot> = {
  id: "print",
  label: "Print",
  toGraph: printSnapshotToGraph,
  deriveSituations: derivePrintSituations,
};

function printSnapshotToGraph(snapshot: PrintSnapshot, now: number): BrainGraph {
  const nodes: BrainNode[] = [
    {
      id: snapshot.device.id,
      type: "device",
      label: snapshot.device.label,
      domain: "print",
      status: snapshot.device.status === "ready" ? "silent" : snapshot.device.status === "offline" ? "blocked" : "watch",
      source: "print",
      updatedAt: now,
      meta: { model: snapshot.device.model, queue: snapshot.device.queue, paper: snapshot.device.paper, profile: snapshot.device.profile },
    },
  ];
  const edges: BrainEdge[] = [];

  for (const job of snapshot.jobs) addJob(nodes, edges, snapshot.device.id, job, now);
  for (const imageSet of snapshot.imageSets) addImageSet(nodes, edges, imageSet, now);

  return { nodes, edges };
}

function addJob(nodes: BrainNode[], edges: BrainEdge[], printerId: string, job: PrintJob, now: number) {
  nodes.push({
    id: job.id,
    type: "job",
    label: job.title,
    domain: "print",
    status: job.status === "staged" ? "approval" : job.status === "failed" ? "blocked" : "silent",
    source: "print",
    updatedAt: now,
    meta: { status: job.status, paper: job.paper, profile: job.profile, printedAt: job.printedAt ?? null },
  });
  edges.push({ from: printerId, to: job.id, type: "targets", source: "print", updatedAt: now });
  if (job.source) edges.push({ from: job.source, to: job.id, type: "derived_from", source: "print", updatedAt: now });
}

function addImageSet(nodes: BrainNode[], edges: BrainEdge[], imageSet: PrintImageSet, now: number) {
  nodes.push({
    id: imageSet.id,
    type: "job",
    label: imageSet.title,
    domain: "print",
    status: imageSet.status === "print_ready" ? "actionable" : "watch",
    source: "print",
    updatedAt: now,
    meta: { status: imageSet.status, files: imageSet.files, sourceSession: imageSet.sourceSession ?? null },
  });
  if (imageSet.sourceSession) edges.push({ from: imageSet.sourceSession, to: imageSet.id, type: "derived_from", source: "print", updatedAt: now });
}

function derivePrintSituations(graph: BrainGraph, _snapshot: PrintSnapshot, now: number): Situation[] {
  const situations: Situation[] = [];
  for (const node of graph.nodes) {
    if (node.domain !== "print") continue;
    if (node.type === "device" && node.status === "blocked") {
      situations.push(basePrintSituation("printer_offline", `${node.label} offline`, `printer offline · ${node.label}`, [node.id], now));
    }
    if (node.type === "job" && node.status === "approval") {
      situations.push(basePrintSituation("print_job_ready", `${node.label} ready`, `staged print needs paper/profile confirmation before physical print`, [node.id], now));
    }
  }
  return situations;
}

function basePrintSituation(type: Situation["type"], title: string, whyNow: string, entities: string[], now: number): Situation {
  return {
    id: `situation:print:${type}:${entities.join("+")}`,
    type,
    title,
    status: "active",
    severity: type === "printer_offline" ? "blocked" : "approval",
    confidence: 0.85,
    entities,
    signals: [],
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
    summary: title,
    whyNow,
    suggestedActions: [
      { id: "print.image.openInAffinity", label: "Open in Affinity", risk: "read" },
      { id: "print.job.stage", label: "Review/stage print", risk: "prepare" },
      { id: "print.job.start", label: "Start print", risk: "physical" },
    ],
    needsHuman: true,
  };
}
