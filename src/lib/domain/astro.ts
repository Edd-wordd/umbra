import type { AstroSession, AstroSnapshot } from "../astro/types";
import type { BrainEdge, BrainGraph, BrainNode } from "../brain/types";
import type { Situation } from "../situations/types";
import type { DomainAdapter } from "./types";

export const ASTRO_DOMAIN_ADAPTER: DomainAdapter<AstroSnapshot> = {
  id: "astro",
  label: "Astro",
  toGraph: astroSnapshotToGraph,
  deriveSituations: deriveAstroSituations,
};

function astroSnapshotToGraph(snapshot: AstroSnapshot, now: number): BrainGraph {
  const nodes: BrainNode[] = [];
  const edges: BrainEdge[] = [];

  for (const device of snapshot.devices) {
    nodes.push({
      id: device.id,
      type: "device",
      label: device.label,
      domain: "astro",
      status: device.status === "connected" ? "silent" : device.status === "disconnected" ? "blocked" : "watch",
      source: "astro",
      updatedAt: now,
      meta: { kind: device.kind, status: device.status },
    });
  }

  for (const target of snapshot.targets) {
    nodes.push({
      id: target.id,
      type: "job",
      label: target.label,
      domain: "astro",
      status: target.status === "visible" ? "actionable" : target.status === "upcoming" ? "watch" : "silent",
      source: "astro",
      updatedAt: now,
      meta: { status: target.status, bestAt: target.bestAt ?? null, altitude: target.altitude ?? null },
    });
  }

  for (const session of snapshot.sessions) addSession(nodes, edges, session, now);
  return { nodes, edges };
}

function addSession(nodes: BrainNode[], edges: BrainEdge[], session: AstroSession, now: number) {
  nodes.push({
    id: session.id,
    type: "session",
    label: session.title,
    domain: "astro",
    status: session.status === "needs_import" ? "actionable" : "fyi",
    source: "astro",
    updatedAt: now,
    meta: { status: session.status, lights: session.lights, darks: session.darks, flats: session.flats, bias: session.bias },
  });
  edges.push({ from: session.id, to: session.targetId, type: "targets", source: "astro", updatedAt: now });
  if (session.imageSetId) edges.push({ from: session.id, to: session.imageSetId, type: "derived_from", source: "astro", updatedAt: now });
}

function deriveAstroSituations(graph: BrainGraph, _snapshot: AstroSnapshot, now: number): Situation[] {
  const situations: Situation[] = [];
  const visibleTarget = graph.nodes.find((node) => node.domain === "astro" && node.type === "job" && node.status === "actionable");
  const unknownDevices = graph.nodes.filter((node) => node.domain === "astro" && node.type === "device" && node.status === "watch");

  if (visibleTarget && unknownDevices.length) {
    situations.push({
      id: `situation:astro:window:${visibleTarget.id}`,
      type: "astro_window_candidate",
      title: `${visibleTarget.label} window candidate`,
      status: "active",
      severity: "actionable",
      confidence: 0.75,
      entities: [visibleTarget.id, ...unknownDevices.map((node) => node.id)],
      signals: [],
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      summary: `${visibleTarget.label} visible; gear status needs confirmation`,
      whyNow: `${visibleTarget.label} is visible, but mount/camera readiness is not confirmed`,
      suggestedActions: [
        { id: "astro.session.plan", label: "Prepare session plan", risk: "prepare" },
        { id: "astro.devices.check", label: "Check gear", risk: "read" },
      ],
      needsHuman: true,
    });
  }

  return situations;
}
