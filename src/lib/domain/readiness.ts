import type { BrainDomain } from "../brain/types";

export type ReadinessState = "active" | "partial" | "stub" | "planned" | "deferred";

export interface DomainReadiness {
  id: BrainDomain | "comms" | "life_ops" | "desk_robot";
  label: string;
  audit: ReadinessState;
  adapter: ReadinessState;
  actions: ReadinessState;
  runbooks: ReadinessState;
  bridge: ReadinessState;
  notes: string;
}

export const DOMAIN_READINESS: readonly DomainReadiness[] = [
  {
    id: "dev",
    label: "Dev",
    audit: "active",
    adapter: "active",
    actions: "partial",
    runbooks: "partial",
    bridge: "partial",
    notes: "Mac helper/Herdr/dev graph working; actions dry-run first, bridge execution still selective.",
  },
  {
    id: "lab",
    label: "Lab / Network",
    audit: "active",
    adapter: "partial",
    actions: "partial",
    runbooks: "partial",
    bridge: "planned",
    notes: "Sample adapter/actions/runbooks exist; needs Proxmox/Docker/Tailscale/service inventory sources."
  },
  {
    id: "print",
    label: "Print",
    audit: "active",
    adapter: "partial",
    actions: "partial",
    runbooks: "partial",
    bridge: "planned",
    notes: "Sample adapter/actions/runbooks exist; needs CUPS/LPR source, print history, staged astro-photo workflow."
  },
  {
    id: "astro",
    label: "Astro",
    audit: "active",
    adapter: "partial",
    actions: "partial",
    runbooks: "partial",
    bridge: "planned",
    notes: "Sample adapter/actions/runbooks exist; needs INDI/OnStep/camera/Parallax/weather sources; physical actions require hard approval."
  },
  {
    id: "business",
    label: "Business",
    audit: "active",
    adapter: "partial",
    actions: "partial",
    runbooks: "partial",
    bridge: "planned",
    notes: "Sample adapter/actions/runbooks exist; needs Frappe CRM leads/deals/proposals; draft-only external comms until approval."
  },
  {
    id: "knowledge",
    label: "Knowledge",
    audit: "active",
    adapter: "partial",
    actions: "partial",
    runbooks: "partial",
    bridge: "partial",
    notes: "Sample adapter/actions/runbooks and Obsidian parser/indexer skeleton exist; vault filesystem bridge not wired yet."
  },
  {
    id: "cameras",
    label: "Cameras",
    audit: "active",
    adapter: "partial",
    actions: "partial",
    runbooks: "partial",
    bridge: "planned",
    notes: "Sample adapter/actions/runbooks exist; needs RTSP/NVR source decisions and minimal health checks."
  },
  {
    id: "ops",
    label: "Ops",
    audit: "active",
    adapter: "partial",
    actions: "partial",
    runbooks: "partial",
    bridge: "active",
    notes: "Internal sample adapter plus cross-domain needs, memory, What Changed, and local triage are working."
  },
  {
    id: "comms",
    label: "Comms strip",
    audit: "active",
    adapter: "planned",
    actions: "planned",
    runbooks: "planned",
    bridge: "planned",
    notes: "Strip only, not a full rail. Source decisions deferred.",
  },
  {
    id: "life_ops",
    label: "Life Ops",
    audit: "deferred",
    adapter: "deferred",
    actions: "deferred",
    runbooks: "deferred",
    bridge: "deferred",
    notes: "Deferred; avoid calendar/task/life dashboard creep.",
  },
  {
    id: "desk_robot",
    label: "Desk Robot",
    audit: "deferred",
    adapter: "deferred",
    actions: "deferred",
    runbooks: "deferred",
    bridge: "deferred",
    notes: "Later physical-action domain with strict safety limits.",
  },
];
