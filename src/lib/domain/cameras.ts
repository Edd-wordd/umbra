import type { BrainEdge, BrainGraph, BrainNode } from "../brain/types";
import type { CamerasSnapshot } from "../cameras/types";
import type { Situation } from "../situations/types";
import type { DomainAdapter } from "./types";

export const CAMERAS_DOMAIN_ADAPTER: DomainAdapter<CamerasSnapshot> = {
  id: "cameras",
  label: "Cameras",
  toGraph: camerasSnapshotToGraph,
  deriveSituations: deriveCameraSituations,
};

function camerasSnapshotToGraph(snapshot: CamerasSnapshot, now: number): BrainGraph {
  const nodes: BrainNode[] = [];
  const edges: BrainEdge[] = [];
  for (const camera of snapshot.cameras) {
    nodes.push({
      id: camera.id,
      type: "device",
      label: camera.label,
      domain: "cameras",
      status: camera.status === "online" ? "silent" : "blocked",
      source: "cameras",
      updatedAt: now,
      meta: { location: camera.location, status: camera.status, streamUrl: camera.streamUrl ?? null, lastSeenAt: camera.lastSeenAt ?? null },
    });
  }
  for (const snapshotEvent of snapshot.snapshots) {
    nodes.push({ id: snapshotEvent.id, type: "job", label: "Camera snapshot", domain: "cameras", status: "fyi", source: "cameras", updatedAt: now, meta: { at: snapshotEvent.at, path: snapshotEvent.path ?? null } });
    edges.push({ from: snapshotEvent.cameraId, to: snapshotEvent.id, type: "triggered", source: "cameras", updatedAt: now });
  }
  return { nodes, edges };
}

function deriveCameraSituations(graph: BrainGraph, _snapshot: CamerasSnapshot, now: number): Situation[] {
  return graph.nodes.flatMap((node) => {
    if (node.domain !== "cameras" || node.type !== "device" || node.status !== "blocked") return [];
    return [
      {
        id: `situation:cameras:offline:${node.id}`,
        type: "camera_offline",
        title: `${node.label} offline`,
        status: "active",
        severity: "blocked",
        confidence: 0.9,
        entities: [node.id],
        signals: [],
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
        summary: `${node.label} stream unavailable`,
        whyNow: `${node.label} has not reported online recently`,
        suggestedActions: [
          { id: "cameras.stream.open", label: "Open stream", risk: "read" },
          { id: "cameras.snapshot.take", label: "Take snapshot", risk: "read" },
          { id: "cameras.service.restart", label: "Prepare restart", risk: "local-risky" },
        ],
        needsHuman: true,
      },
    ];
  });
}
