import type { DomainId, Graph, GraphEdge, GraphNode, NodeKind, NodeStatus } from "./types";
import { DOMAINS, DOMAIN_LABEL, hubId } from "./types";

/**
 * SAMPLE dataset. Names mirror real things (repos, devices, notes, leads,
 * sessions) but every value is made up. Replaced by live bridge data later.
 */
const nodes: GraphNode[] = [];
const edges: GraphEdge[] = [];

function node(
  id: string,
  kind: NodeKind,
  domain: DomainId,
  label: string,
  opts: { status?: NodeStatus; featured?: boolean } = {},
): string {
  nodes.push({ id, kind, domain, label, ...opts });
  return id;
}
const contains = (source: string, target: string) => edges.push({ source, target, kind: "contains" });
const link = (source: string, target: string, kind: GraphEdge["kind"]) => edges.push({ source, target, kind });

DOMAINS.forEach((d) => node(hubId(d), "domain", d, DOMAIN_LABEL[d]));

// --- dev -------------------------------------------------------------------
const umbra = node("repo:umbra", "repo", "dev", "umbra", { featured: true });
const deadbridge = node("repo:deadbridge-crm", "repo", "dev", "deadbridge-crm", { featured: true });
const parallax = node("repo:parallax", "repo", "dev", "parallax");
const homelabIac = node("repo:homelab-iac", "repo", "dev", "homelab-iac");
node("repo:dotfiles", "repo", "dev", "dotfiles");
const figma = node("service:figma", "service", "dev", "figma: console v0");
[umbra, deadbridge, parallax, homelabIac, "repo:dotfiles", figma].forEach((id) => contains(hubId("dev"), id));
contains(umbra, node("pr:142", "pr", "dev", "PR #142", { status: "ok", featured: true }));
contains(umbra, node("pr:138", "pr", "dev", "PR #138"));
contains(umbra, node("ci:umbra", "alert", "dev", "ci: umbra ✓", { status: "ok" }));
contains(umbra, node("sentry:SAMPLE-1F", "alert", "dev", "sentry: SAMPLE-1F", { status: "attention", featured: true }));
contains(deadbridge, node("pr:57", "pr", "dev", "PR #57", { featured: true }));
contains(deadbridge, node("ci:deadbridge", "alert", "dev", "ci: deadbridge ✕", { status: "broken", featured: true }));
contains(deadbridge, node("sentry:SAMPLE-0A", "alert", "dev", "sentry: SAMPLE-0A", { status: "attention", featured: true }));
contains(deadbridge, node("posthog:deadbridge", "alert", "dev", "posthog: deadbridge.app"));
link(figma, umbra, "references");

// --- lab / net ----------------------------------------------------------------
const proxmox = node("device:proxmox", "device", "lab", "proxmox", { featured: true });
const docker = node("device:docker-01", "device", "lab", "docker-01");
const bridge = node("device:bridge", "device", "lab", "bridge", { featured: true, status: "ok" });
const supabase = node("device:supabase", "service", "lab", "supabase", { featured: true });
const adguard = node("device:adguard", "device", "lab", "adguard", { featured: true });
const tailscale = node("device:tailscale", "service", "lab", "tailscale");
[proxmox, docker, bridge, supabase, adguard, tailscale].forEach((id) => contains(hubId("lab"), id));
contains(docker, node("service:n8n", "service", "lab", "n8n"));
contains(docker, node("service:portainer", "service", "lab", "portainer"));
contains(bridge, node("device:mac-helper", "device", "lab", "mac-helper"));
link(docker, proxmox, "runs-on");
link(bridge, proxmox, "runs-on");
link(umbra, supabase, "depends");
link(umbra, bridge, "depends");
link(homelabIac, proxmox, "references");
link(tailscale, bridge, "depends");

// --- print ---------------------------------------------------------------------
const pro1000 = node("device:pro-1000", "device", "print", "PRO-1000", { featured: true });
const cups = node("device:cups", "device", "print", "cups", { featured: true });
contains(hubId("print"), pro1000);
contains(hubId("print"), cups);
contains(cups, node("job:print-0931", "job", "print", "job 0931"));
contains(cups, node("job:print-0932", "job", "print", "job 0932"));
contains(pro1000, node("device:ink-cyan", "device", "print", "ink: cyan 8%", { status: "attention", featured: true }));
link(cups, pro1000, "depends");
link(cups, bridge, "runs-on");

// --- astro ----------------------------------------------------------------------
const pi = node("device:pi-indi", "device", "astro", "pi-indi", { featured: true });
const onstep = node("device:onstep", "device", "astro", "onstep", { featured: true });
const a7 = node("device:a7ii", "device", "astro", "sony a7 II");
const m31 = node("target:M31", "target", "astro", "M31", { featured: true });
const m42 = node("target:M42", "target", "astro", "M42");
const m45 = node("target:M45", "target", "astro", "M45");
[pi, onstep, a7, m31, m42, m45].forEach((id) => contains(hubId("astro"), id));
contains(pi, node("device:guide-cam", "device", "astro", "guide cam"));
contains(onstep, node("device:focuser", "device", "astro", "focuser"));
const sessions = ["09-14", "09-28", "10-02"].map((d) =>
  node(`session:${d}`, "session", "astro", `session ${d}`),
);
sessions.forEach((s) => contains(a7, s));
link(pi, onstep, "depends");
link(pi, a7, "depends");
link(pi, bridge, "depends");
link(sessions[2], m31, "observes");
link(sessions[1], m45, "observes");
[m31, m42, m45].forEach((t) => link(t, parallax, "references"));

// --- business --------------------------------------------------------------------
const frappe = node("service:frappe-crm", "service", "business", "frappe crm", { featured: true });
contains(hubId("business"), frappe);
link(frappe, deadbridge, "depends");
for (let i = 1; i <= 7; i++) {
  contains(
    frappe,
    node(`lead:${i}`, "lead", "business", i === 7 ? "lead: Sample Studio LLC" : `lead ${i}`, {
      featured: i === 7,
      status: i === 7 ? "attention" : undefined,
    }),
  );
}

// --- cameras ----------------------------------------------------------------------
const nvr = node("camera:nvr", "camera", "cameras", "nvr", { featured: true });
["porch", "garage", "desk"].forEach((c) => {
  const id = node(`camera:${c}`, "camera", "cameras", c, { featured: true });
  contains(hubId("cameras"), id);
  link(id, nvr, "depends");
});
contains(hubId("cameras"), nvr);
link(nvr, proxmox, "runs-on");

// --- knowledge (Obsidian vault; links become edges) --------------------------------
const vault = node("note:vault", "note", "knowledge", "vault", { featured: true });
const mocs = ["astro", "homelab", "dev"].map((m) =>
  node(`note:moc-${m}`, "note", "knowledge", `MOC ${m}`, { featured: true }),
);
contains(hubId("knowledge"), vault);
mocs.forEach((m) => contains(hubId("knowledge"), m));
const noteTitles = [
  "observing log 10-02",
  "M31 framing",
  "flat frames how-to",
  "proxmox backups",
  "adguard lists",
  "umbra design rules",
  "deadbridge pricing",
  "print profiles PRO-1000",
  "tailscale acl",
  "daily 10-05",
];
noteTitles.forEach((t, i) => {
  const id = node(`note:${i}`, "note", "knowledge", t);
  contains(i < 3 ? mocs[0] : i < 5 ? mocs[1] : i < 7 ? mocs[2] : vault, id);
});
link("note:0", sessions[2], "references");
link("note:1", m31, "references");
link("note:3", proxmox, "references");
link("note:5", umbra, "references");
link("note:6", frappe, "references");
link("note:7", pro1000, "references");

export const sampleGraph: Graph = { nodes, edges };
