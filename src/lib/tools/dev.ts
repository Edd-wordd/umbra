import { useDevStore } from "../dev/store";
import type { Tool } from "./types";

/**
 * Dev focus tools (SAMPLE bridge). Same tool layer as every other action:
 * the Dev focus buttons, the ⌘K palette and (Phase 3) voice all call these.
 */
export const DEV_TOOLS: readonly Tool[] = [
  {
    id: "dev.focus.open",
    domain: "dev",
    title: "Open Dev focus (agents · terminal · ports)",
    risk: "read",
    keywords: ["agents", "terminal", "cursor", "codex", "sessions", "workspace"],
    run: async (ctx) => {
      ctx.wakeRail("dev");
      return { ok: true, message: "dev focus" };
    },
  },
  {
    id: "dev.projects.open",
    domain: "dev",
    title: "Open Dev projects (services per repo)",
    risk: "read",
    keywords: ["github", "sentry", "posthog", "supabase", "docker", "figma", "projects", "repos"],
    run: async (ctx) => {
      ctx.wakeRail("dev");
      const repo = ctx.args?.repo;
      if (repo) useDevStore.setState({ expandedProject: repo, pickerFor: null });
      return { ok: true, message: repo ? `dev · ${repo} services` : "dev projects" };
    },
  },
  {
    id: "dev.tests.run",
    domain: "dev",
    title: "Run parallax tests",
    risk: "read",
    keywords: ["vitest", "test", "parallax", "ci"],
    run: async (ctx) => {
      ctx.wakeRail("dev");
      useDevStore.getState().runTests(ctx.args?.repo ?? "parallax", ctx.source);
      return { ok: true, message: "SAMPLE · parallax tests running" };
    },
  },
  {
    id: "dev.port.free",
    domain: "dev",
    title: "Free port 3000 (kill stale pid)",
    risk: "confirm",
    keywords: ["kill", "port", "3000", "process", "next dev"],
    run: async (ctx) => useDevStore.getState().killPort(Number(ctx.args?.port ?? 3000), { approved: ctx.approved, source: ctx.source }),
  },
  {
    id: "dev.ci.rerun",
    domain: "dev",
    title: "Rerun failing CI (parallax)",
    risk: "confirm",
    keywords: ["github", "actions", "tests", "ci"],
    run: async (ctx) => {
      useDevStore.getState().runTests(ctx.args?.repo ?? "parallax", ctx.source);
      return { ok: true, message: "SAMPLE · parallax ci rerun requested" };
    },
  },
  {
    id: "dev.link.open",
    domain: "dev",
    title: "Open service link (repo, Sentry issue, dashboard…)",
    risk: "read",
    keywords: ["open", "link", "browser"],
    run: async (ctx) => {
      const label = ctx.args?.label ?? "link";
      useDevStore.getState().log(ctx.source, `open ${label} ↗ · sample, no browser`, "info");
      return { ok: true, message: `SAMPLE · would open ${label}` };
    },
  },
  {
    id: "dev.sessions.resume",
    domain: "dev",
    title: "Resume dev sessions (where you left off)",
    risk: "read",
    keywords: ["handoff", "resume", "left off", "reattach", "tmux"],
    run: async (ctx) => {
      ctx.wakeRail("dev");
      useDevStore.getState().resumeSessions(ctx.source);
      return { ok: true, message: "SAMPLE · sessions reattached" };
    },
  },
];
