import { useDevStore } from "../dev/store";
import type { Tool } from "./types";

/**
 * Dev focus tools. Same tool layer as every other action: the ⌘K palette and
 * (Phase 3) voice call these. The Dev view itself only reads and jumps.
 */
export const DEV_TOOLS: readonly Tool[] = [
  {
    id: "dev.focus.open",
    domain: "dev",
    title: "Open Dev focus (pings · projects)",
    risk: "read",
    keywords: ["agents", "pings", "herdr", "cursor", "codex", "workspace"],
    run: async (ctx) => {
      ctx.wakeRail("dev");
      return { ok: true, message: "dev focus" };
    },
  },
  {
    id: "dev.projects.open",
    domain: "dev",
    title: "Open a Dev project (agents, branches, ports)",
    risk: "read",
    keywords: ["github", "git", "projects", "repos", "branches", "ports"],
    run: async (ctx) => {
      ctx.wakeRail("dev");
      const repo = ctx.args?.repo;
      if (repo) useDevStore.setState({ expandedProject: repo });
      return { ok: true, message: repo ? `dev · ${repo}` : "dev projects" };
    },
  },
];
