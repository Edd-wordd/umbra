import { DEV_TOOLS } from "./dev";
import type { Tool, ToolContext, ToolResult } from "./types";

/**
 * Placeholder tools. Every run() is a STUB: nothing touches real systems yet.
 * Real implementations call the local bridge (Phase 2+).
 */
const stub = (message: string) => async (): Promise<ToolResult> => ({ ok: true, message: `SAMPLE · ${message}` });

export const TOOLS: readonly Tool[] = [
  {
    id: "astro.mount.slew",
    domain: "astro",
    title: "Slew mount to target…",
    risk: "physical",
    keywords: ["goto", "telescope", "m31", "onstep"],
    run: stub("slew M31 queued (stub, no hardware)"),
  },
  {
    id: "astro.mount.park",
    domain: "astro",
    title: "Park mount",
    risk: "physical",
    keywords: ["telescope", "home", "onstep"],
    run: stub("park queued (stub, no hardware)"),
  },
  {
    id: "astro.mode",
    domain: "astro",
    title: "Enter Astro mode (mesh → orrery)",
    risk: "read",
    keywords: ["orrery", "sky", "tonight"],
    run: async (ctx) => {
      ctx.setMode("astro");
      return { ok: true, message: "astro mode (orrery lands in phase 5)" };
    },
  },
  {
    id: "knowledge.note.new",
    domain: "knowledge",
    title: "“log tonight’s session”",
    risk: "confirm",
    keywords: ["obsidian", "write", "note", "journal"],
    run: stub("note draft created (stub)"),
  },
  {
    id: "print.queue",
    domain: "print",
    title: "Show PRO-1000 queue",
    risk: "read",
    keywords: ["cups", "printer", "jobs"],
    run: async (ctx) => {
      ctx.wakeRail("print");
      return { ok: true, message: "print rail" };
    },
  },
  ...DEV_TOOLS,
  {
    id: "lab.adguard.pause",
    domain: "lab",
    title: "Pause AdGuard protection 5m",
    risk: "confirm",
    keywords: ["dns", "ads", "block"],
    run: stub("adguard paused 5m (stub)"),
  },
  {
    id: "business.leads.open",
    domain: "business",
    title: "Open new leads",
    risk: "read",
    keywords: ["deadbridge", "crm", "frappe"],
    run: async (ctx) => {
      ctx.wakeRail("business");
      return { ok: true, message: "business rail · leads" };
    },
  },
];

export const getTool = (id: string): Tool | undefined => TOOLS.find((t) => t.id === id);

export const needsApproval = (tool: Tool) => tool.risk !== "read";

/**
 * The single entry point for running a tool. Enforces the approval gate here,
 * in the tool layer, so no caller (button, voice, palette) can skip it.
 */
export async function runTool(tool: Tool, ctx: ToolContext): Promise<ToolResult> {
  if (needsApproval(tool) && !ctx.approved) {
    return { ok: false, message: `${tool.id} needs approval (${tool.risk})` };
  }
  try {
    return await tool.run(ctx);
  } catch (err) {
    return { ok: false, message: `${tool.id} failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Subsequence fuzzy score on id + title + keywords. Higher is better; -1 = no match. */
function score(query: string, text: string): number {
  const q = query.toLowerCase().replace(/\s+/g, "");
  const s = text.toLowerCase();
  if (!q) return 0;
  const direct = s.indexOf(query.toLowerCase().trim());
  if (direct >= 0) return 1000 - direct;
  let qi = 0;
  let last = -1;
  let gaps = 0;
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) {
      if (last >= 0) gaps += i - last - 1;
      last = i;
      qi++;
    }
  }
  return qi === q.length ? 500 - gaps : -1;
}

export function searchTools(query: string, tools: readonly Tool[] = TOOLS): Tool[] {
  if (!query.trim()) return [...tools];
  return tools
    .map((t) => ({ t, s: Math.max(score(query, t.id), score(query, t.title), ...(t.keywords ?? []).map((k) => score(query, k)) ) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t);
}
