import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { HerdrConfig } from "./herdr.js";

/**
 * helper/umbra.helper.json (gitignored). Created on first run with a fresh
 * token; `UMBRA_HELPER_CONFIG=/path/to.json` points elsewhere (tests).
 *
 * Projects come from Herdr: whatever repos the open Herdr workspaces are in.
 * `projects` here only overrides per-project details (services, dev, test),
 * matched by repo folder name or absolute path. `fallbackProjects` is used
 * only when Herdr isn't running.
 */
export interface ProjectConfig {
  /** Repo folder name (e.g. "deadbridge-site") … */
  repo: string;
  /** … or an explicit path (absolute, ~/…, or relative to projectsRoot). */
  path?: string;
  /** Service adapters shown for this project (ids from src/lib/dev/services). Default: ["github"]. */
  services?: string[];
  /** How to start its dev server from Umbra (START shows while nothing listens on that port). */
  dev?: { command: string; port: number };
  /** Command for "run tests" (default: pnpm test). */
  test?: string;
}

export interface AgentCommand {
  command: string;
  args?: string[];
}

export interface HelperConfig {
  host: string;
  port: number;
  token: string;
  herdr: HerdrConfig;
  projectsRoot: string;
  /** Per-project overrides (Herdr decides which projects exist). */
  projects: ProjectConfig[];
  /** Watched when Herdr isn't running. */
  fallbackProjects: ProjectConfig[];
  /** Fallback only (no Herdr): agents "send to agent" may start in a helper-owned terminal. */
  agents: Record<string, AgentCommand>;
  /** Extra origins allowed to open the socket (localhost / 127.0.0.1 on any port are always allowed). */
  allowedOrigins: string[];
  poll: { herdrSeconds: number; procSeconds: number; gitSeconds: number; ciSeconds: number };
  /** Helper-owned terminals (fallback shells/tests): auto = script(1) pty if present, else pipes. */
  pty: "auto" | "script" | "pipe";
  staleBranchDays: number;
  /** Closed Herdr projects stay in "recent" this long. */
  recentHours: number;
  /** Listening ports never shown (databases, Docker, other apps' local servers). */
  ignorePorts: number[];
}

export const HELPER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const expandHome = (p: string) => (p === "~" ? homedir() : p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);

const FALLBACK: ProjectConfig[] = [
  { repo: "umbra" },
  { repo: "parallax" },
  { repo: "deadbridge-site" },
  { repo: "google" },
  { repo: "theHuddle" },
  { repo: "carne-seca-ecommerce" },
];

export function defaultConfig(token: string): HelperConfig {
  return {
    host: "127.0.0.1",
    port: 7317,
    token,
    herdr: { transport: "auto", socket: "~/.config/herdr/herdr.sock", bin: "herdr" },
    projectsRoot: "~/Documents/codes/projects",
    projects: [
      { repo: "parallax", services: ["github", "sentry"] },
      { repo: "deadbridge-site", services: ["github", "supabase", "posthog", "docker", "figma"] },
      { repo: "theHuddle", services: ["github", "supabase"] },
    ],
    fallbackProjects: FALLBACK,
    agents: { cursor: { command: "cursor-agent" }, claude: { command: "claude" } },
    allowedOrigins: [],
    poll: { herdrSeconds: 2, procSeconds: 5, gitSeconds: 30, ciSeconds: 120 },
    pty: "auto",
    staleBranchDays: 14,
    recentHours: 12,
    ignorePorts: [],
  };
}

export function configPath(): string {
  const p = process.env.UMBRA_HELPER_CONFIG;
  return p ? resolve(p) : join(HELPER_DIR, "umbra.helper.json");
}

export interface LoadedConfig {
  config: HelperConfig;
  path: string;
  created: boolean;
}

export function loadConfig(): LoadedConfig {
  const path = configPath();
  if (!existsSync(path)) {
    const config = defaultConfig(randomBytes(32).toString("base64url"));
    writeFileSync(path, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
    return { config: resolvePaths(config), path, created: true };
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<HelperConfig>;
  const base = defaultConfig(raw.token ?? "");
  const config: HelperConfig = {
    ...base,
    ...raw,
    herdr: { ...base.herdr, ...raw.herdr },
    poll: { ...base.poll, ...raw.poll },
    agents: raw.agents ?? base.agents,
  };
  if (!config.token || config.token.length < 24) {
    config.token = randomBytes(32).toString("base64url");
    writeFileSync(path, JSON.stringify({ ...raw, token: config.token }, null, 2) + "\n", { mode: 0o600 });
  }
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best effort */
  }
  if (!["127.0.0.1", "::1", "localhost"].includes(config.host)) {
    // v1 is loopback only (Tailscale later): refuse rather than silently exposing the socket.
    throw new Error(`host "${config.host}" refused: the helper binds 127.0.0.1 only in v1`);
  }
  return { config: resolvePaths(config), path, created: false };
}

function resolvePaths(c: HelperConfig): HelperConfig {
  return { ...c, herdr: { ...c.herdr, socket: expandHome(c.herdr.socket) } };
}

export function projectPath(c: HelperConfig, p: ProjectConfig): string {
  const root = expandHome(c.projectsRoot);
  if (!p.path) return join(root, p.repo);
  const x = expandHome(p.path);
  return isAbsolute(x) ? x : join(root, x);
}
