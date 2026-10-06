import type { DomainId } from "./graph";

/** Edge rails: tiny labeled ticks; touching one wakes only that rail. */
export type RailId = DomainId;
export type RailSide = "left" | "right";

export interface RailDef {
  id: RailId;
  label: string;
  side: RailSide;
  /** Tick y-position in the 1920x1080 reference frame. */
  y: number;
}

export const RAILS: readonly RailDef[] = [
  { id: "dev", label: "DEV", side: "left", y: 330 },
  { id: "lab", label: "LAB/NET", side: "left", y: 450 },
  { id: "print", label: "PRINT", side: "left", y: 570 },
  { id: "astro", label: "ASTRO", side: "right", y: 330 },
  { id: "business", label: "BUSINESS", side: "right", y: 450 },
  { id: "cameras", label: "CAMERAS", side: "right", y: 570 },
  { id: "knowledge", label: "KNOWLEDGE", side: "right", y: 690 },
];

export const getRail = (id: RailId) => RAILS.find((r) => r.id === id)!;

/* ------------------------------------------------------------------------- */
/* SAMPLE rail panel content. Every value below is made up.                    */
/* ------------------------------------------------------------------------- */

export type Tone = "ink" | "mid" | "dim" | "active" | "attention" | "broken";

export interface PanelRow {
  cells: { text: string; tone?: Tone; align?: "end" }[];
}

export interface PanelSection {
  title: string;
  source?: string;
  rows: PanelRow[];
}

export interface PanelContent {
  sections: PanelSection[];
  /** Row actions; each one names a tool in the shared tool layer. */
  actions: { label: string; toolId: string }[];
}

const r = (...cells: PanelRow["cells"]): PanelRow => ({ cells });

export const RAIL_SAMPLE: Record<RailId, PanelContent> = {
  dev: {
    sections: [
      {
        title: "PULL REQUESTS",
        source: "3 open · github",
        rows: [
          r({ text: "#142" }, { text: "umbra" }, { text: "feat/mesh-sim" }, { text: "review", tone: "active", align: "end" }),
          r({ text: "#138" }, { text: "umbra" }, { text: "chore/tw-tokens" }, { text: "✓ ready", tone: "mid", align: "end" }),
          r({ text: "#57" }, { text: "deadbridge" }, { text: "fix/lead-dedupe" }, { text: "✕ checks", tone: "broken", align: "end" }),
        ],
      },
      {
        title: "TESTS · main",
        source: "ci",
        rows: [
          r({ text: "umbra" }, { text: "212 pass · 0 fail" }, { text: "✓", tone: "mid", align: "end" }),
          r({ text: "deadbridge" }, { text: "88 pass · 2 fail" }, { text: "✕", tone: "broken", align: "end" }),
          r({ text: "  ✕ leads.dedupe.spec › merges by email", tone: "broken" }),
        ],
      },
      {
        title: "SENTRY · 24h",
        source: "sentry",
        rows: [
          r({ text: "SAMPLE-1F" }, { text: "TypeError: node.x undef" }, { text: "×14", tone: "attention", align: "end" }),
          r({ text: "SAMPLE-0A" }, { text: "Timeout /api/leads" }, { text: "×3", tone: "attention", align: "end" }),
        ],
      },
      {
        title: "POSTHOG · 24h",
        source: "deadbridge.app",
        rows: [r({ text: "pageviews" }, { text: "▲ +38% blip vs 7d avg", tone: "attention", align: "end" })],
      },
      {
        title: "FIGMA",
        source: "figma",
        rows: [r({ text: "Umbra / Console v0" }, { text: "edited 40m ago", tone: "dim", align: "end" })],
      },
    ],
    actions: [
      { label: "open PR #57", toolId: "dev.prs.open" },
      { label: "rerun ci", toolId: "dev.ci.rerun" },
    ],
  },
  lab: {
    sections: [
      {
        title: "PROXMOX",
        source: "pve · bridge",
        rows: [
          r({ text: "pve-01" }, { text: "cpu 14% · mem 61%" }, { text: "up 23d", tone: "mid", align: "end" }),
          r({ text: "docker-01" }, { text: "11 containers" }, { text: "✓", tone: "mid", align: "end" }),
        ],
      },
      {
        title: "ADGUARD · 24h",
        source: "adguard",
        rows: [
          r({ text: "queries" }, { text: "48,210" }, { text: "18% blocked", tone: "dim", align: "end" }),
          r({ text: "protection" }, { text: "on", tone: "active", align: "end" }),
        ],
      },
      {
        title: "TAILNET",
        source: "tailscale",
        rows: [r({ text: "4 / 4 nodes online" }, { text: "✓", tone: "mid", align: "end" })],
      },
    ],
    actions: [{ label: "pause adguard 5m", toolId: "lab.adguard.pause" }],
  },
  print: {
    sections: [
      {
        title: "PRO-1000",
        source: "cups · lpr",
        rows: [
          r({ text: "state" }, { text: "idle", tone: "mid", align: "end" }),
          r({ text: "ink cyan" }, { text: "8%", tone: "attention", align: "end" }),
        ],
      },
      {
        title: "QUEUE",
        source: "2 jobs",
        rows: [
          r({ text: "0931" }, { text: "m31-final.tif · A3+" }, { text: "held", tone: "dim", align: "end" }),
          r({ text: "0932" }, { text: "contact-sheet.pdf" }, { text: "held", tone: "dim", align: "end" }),
        ],
      },
    ],
    actions: [{ label: "show queue", toolId: "print.queue" }],
  },
  astro: {
    sections: [
      {
        title: "TONIGHT",
        source: "sample",
        rows: [
          r({ text: "astro dark" }, { text: "21:48 → 04:55", tone: "active", align: "end" }),
          r({ text: "moon" }, { text: "23% · sets 23:12", align: "end" }),
        ],
      },
      {
        title: "TARGET",
        source: "via parallax",
        rows: [r({ text: "M31 Andromeda" }, { text: "alt 34° · tr 00:48", align: "end" })],
      },
      {
        title: "MOUNT",
        source: "onstep · indi",
        rows: [
          r({ text: "state" }, { text: "parked · tracking off", align: "end" }),
          r({ text: "next" }, { text: "slew M31 — needs approval", tone: "attention", align: "end" }),
        ],
      },
    ],
    actions: [
      { label: "slew M31", toolId: "astro.mount.slew" },
      { label: "astro mode", toolId: "astro.mode" },
    ],
  },
  business: {
    sections: [
      {
        title: "LEADS",
        source: "deadbridge · frappe",
        rows: [
          r({ text: "Sample Studio LLC" }, { text: "web form · 6m", tone: "attention", align: "end" }),
          r({ text: "lead 6" }, { text: "contacted", tone: "dim", align: "end" }),
          r({ text: "lead 5" }, { text: "proposal", tone: "dim", align: "end" }),
        ],
      },
    ],
    actions: [{ label: "open leads", toolId: "business.leads.open" }],
  },
  cameras: {
    sections: [
      {
        title: "FEEDS",
        source: "rtsp · tbd",
        rows: [
          r({ text: "porch" }, { text: "idle", tone: "dim", align: "end" }),
          r({ text: "garage" }, { text: "idle", tone: "dim", align: "end" }),
          r({ text: "desk" }, { text: "idle", tone: "dim", align: "end" }),
        ],
      },
    ],
    actions: [],
  },
  knowledge: {
    sections: [
      {
        title: "VAULT",
        source: "obsidian",
        rows: [
          r({ text: "notes" }, { text: "1,284", align: "end" }),
          r({ text: "last edit" }, { text: "daily 10-05 · 2h", tone: "dim", align: "end" }),
        ],
      },
      {
        title: "RECENT",
        rows: [
          r({ text: "observing log 10-02" }),
          r({ text: "umbra design rules" }),
        ],
      },
    ],
    actions: [{ label: "log tonight's session", toolId: "knowledge.note.new" }],
  },
};
