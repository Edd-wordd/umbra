/**
 * Umbra brain graph model.
 *
 * Nodes are real things (repos, devices, notes, leads, sessions, cameras,
 * targets) with live state; edges are defined relationships. The core, the
 * rails and the tool layer all read this same model.
 */

/** The seven domain sectors of the core (and the seven edge rails). */
export const DOMAINS = [
  "dev",
  "lab",
  "print",
  "astro",
  "business",
  "cameras",
  "knowledge",
] as const;
export type DomainId = (typeof DOMAINS)[number];

export const DOMAIN_LABEL: Record<DomainId, string> = {
  dev: "DEV",
  lab: "LAB/NET",
  print: "PRINT",
  astro: "ASTRO",
  business: "BUSINESS",
  cameras: "CAMERAS",
  knowledge: "KNOWLEDGE",
};

export type NodeKind =
  | "domain" // one hub per sector
  | "repo"
  | "device"
  | "note"
  | "lead"
  | "session"
  | "camera"
  | "target"
  // supporting kinds used by the sample data
  | "service"
  | "pr"
  | "alert"
  | "job";

/**
 * Live state of a node. Maps onto the activity palette when its sector is lit:
 * ok/idle -> cyan, attention -> amber, broken -> red.
 */
export type NodeStatus = "idle" | "ok" | "attention" | "broken";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  domain: DomainId;
  label: string;
  status?: NodeStatus;
  /** Labelled in the core when its sector is awake. */
  featured?: boolean;
  /** Free-form metadata from the source system (sample only for now). */
  meta?: Record<string, string | number | boolean>;
}

export type EdgeKind =
  | "contains" // hierarchy: domain -> entity -> child (drives core layout)
  | "depends" // runtime dependency (repo -> supabase)
  | "runs-on" // service/device hosted on another device
  | "references" // note -> anything
  | "observes"; // session -> target

export interface GraphEdge {
  source: string;
  target: string;
  kind: EdgeKind;
}

export interface Graph {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
}

export const hubId = (d: DomainId) => `domain:${d}` as const;
