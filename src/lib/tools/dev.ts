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
