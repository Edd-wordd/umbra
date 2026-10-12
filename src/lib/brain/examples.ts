import { shortestPath } from "./graph";
import type { BrainGraph, GraphPath } from "./types";

export interface GraphExample {
  id: string;
  title: string;
  from: string;
  to: string;
  path?: GraphPath;
  summary: string;
}

export function buildGraphExamples(graph: BrainGraph): GraphExample[] {
  return [
    example(graph, "astro-to-print", "Astro session → print job", "astro-session:m31-2026-10-05", "printjob:m31-proof-staged"),
    example(graph, "lead-to-appointment", "Business lead → appointment", "lead:frappe:deadbridge-acme", "appointment:frappe:acme-review"),
    example(graph, "lab-service-to-backup", "Lab service → backup", "service:lab:immich", "backup:lab:immich"),
    example(graph, "camera-to-snapshot", "Camera → snapshot", "device:camera:front", "snapshot:camera:front:last"),
  ];
}

function example(graph: BrainGraph, id: string, title: string, from: string, to: string): GraphExample {
  const path = shortestPath(graph, from, to, { maxDepth: 4, direction: "both" });
  return {
    id,
    title,
    from,
    to,
    path,
    summary: path ? path.nodes.map((node) => `${node.label} (${node.type})`).join(" → ") : "no path found",
  };
}
