import { existsSync } from "node:fs";
import { basename } from "node:path";
import { BIN_DIRS, run } from "./exec.js";

/**
 * Process table + listening sockets + working directories, via `ps` and
 * `lsof` (both ship with macOS: /bin/ps, /usr/sbin/lsof). Parsing is kept
 * in small pure functions so it can be tested against captured output.
 */

export interface Proc {
  pid: number;
  ppid: number;
  uid: number;
  /** Seconds since start. */
  elapsed: number;
  command: string;
}

export interface Listener {
  pid: number;
  /** lsof's (truncated) command name. */
  name: string;
  ports: number[];
}

const which = (bin: string) => {
  for (const d of BIN_DIRS) if (existsSync(`${d}/${bin}`)) return `${d}/${bin}`;
  return bin;
};
const LSOF = which("lsof");
const PS = existsSync("/bin/ps") ? "/bin/ps" : "ps";

/** `[[dd-]hh:]mm:ss` (BSD and procps agree on this format). */
export function parseEtime(s: string): number {
  const m = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/.exec(s.trim());
  if (!m) return 0;
  const [, d, h, mm, ss] = m;
  return (Number(d ?? 0) * 24 + Number(h ?? 0)) * 3600 + Number(mm) * 60 + Number(ss);
}

export function parsePs(out: string): Map<number, Proc> {
  const procs = new Map<number, Proc>();
  for (const line of out.split("\n")) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const pid = Number(m[1]);
    procs.set(pid, { pid, ppid: Number(m[2]), uid: Number(m[3]), elapsed: parseEtime(m[4]), command: m[5].trim() });
  }
  return procs;
}

export async function listProcs(): Promise<Map<number, Proc>> {
  const r = await run(PS, ["-A", "-o", "pid=,ppid=,uid=,etime=,command="], { timeoutMs: 5000 });
  return parsePs(r.stdout);
}

/** `lsof -F pcn` records: p<pid> c<command> then f/n per file. Port = after the last ':' of n. */
export function parseLsofListen(out: string): Listener[] {
  const byPid = new Map<number, Listener>();
  let cur: Listener | undefined;
  for (const line of out.split("\n")) {
    const tag = line[0];
    const v = line.slice(1);
    if (tag === "p") {
      const pid = Number(v);
      cur = byPid.get(pid) ?? { pid, name: "", ports: [] };
      byPid.set(pid, cur);
    } else if (tag === "c" && cur) cur.name = v;
    else if (tag === "n" && cur) {
      const port = Number(v.slice(v.lastIndexOf(":") + 1));
      if (Number.isInteger(port) && port > 0 && !cur.ports.includes(port)) cur.ports.push(port);
    }
  }
  return [...byPid.values()].filter((l) => l.ports.length);
}

export async function listListeners(): Promise<Listener[]> {
  const r = await run(LSOF, ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpcn"], { timeoutMs: 8000 });
  return parseLsofListen(r.stdout);
}

export function parseLsofCwd(out: string): Map<number, string> {
  const cwd = new Map<number, string>();
  let pid = 0;
  for (const line of out.split("\n")) {
    if (line[0] === "p") pid = Number(line.slice(1));
    else if (line[0] === "n" && pid) cwd.set(pid, line.slice(1));
  }
  return cwd;
}

export async function cwdsOf(pids: number[]): Promise<Map<number, string>> {
  if (!pids.length) return new Map();
  // lsof exits 1 when one of the pids vanished; the rest of the output is still valid.
  const r = await run(LSOF, ["-a", "-p", pids.join(","), "-d", "cwd", "-Fpn"], { timeoutMs: 8000 });
  return parseLsofCwd(r.stdout);
}

/* --- classification -------------------------------------------------------- */

const DEV_LIKE = /(^|[\s/])(node|next-server|next|vite|nuxt|astro|remix|webpack|python[0-9.]*|uvicorn|gunicorn|flask|ruby|rails|puma|php|deno|bun|hugo|jekyll|storybook|wrangler|supabase)([\s:]|$)/i;
export const isDevLike = (command: string) => DEV_LIKE.test(command);

/** "next dev", "vite", "python3 -m http.server 8000", "node server.js" … */
export function shortCommand(command: string): string {
  const parts = command.split(/\s+/).filter(Boolean);
  const argv0 = basename(parts[0] ?? "");
  const rest = parts.slice(1);
  if (/^next-server/.test(command)) return "next-server";
  const next = rest.findIndex((a) => /(^|\/)next$/.test(a));
  if (next >= 0) return `next ${rest[next + 1] ?? ""}`.trim();
  const tool = rest.find((a) => /(^|\/)(vite|astro|nuxt|remix|webpack|storybook|wrangler)(\.js)?$/.test(a));
  if (tool) return `${basename(tool).replace(/\.js$/, "")}${rest.includes("dev") ? " dev" : ""}`;
  if (/^python/.test(argv0)) return [argv0, ...rest.slice(0, 3)].join(" ");
  if (argv0 === "node" && rest[0]) return `node ${basename(rest.find((a) => !a.startsWith("-")) ?? rest[0])}`;
  return [argv0, ...rest.filter((a) => !a.startsWith("-")).slice(0, 1).map((a) => basename(a))].join(" ").slice(0, 48);
}

export interface AgentMatch {
  kind: string;
}

const AGENTS: { kind: string; re: RegExp }[] = [
  { kind: "cursor", re: /(?:^|\/)cursor-agent(?:\/|\s|$)/ },
  { kind: "claude", re: /(?:^|\/)claude(?:\/|\s|$)|claude-code\/cli\.js/ },
  { kind: "codex", re: /(?:^|\/)codex(?:\/|\s|$)/ },
  { kind: "aider", re: /(?:^|\/)aider(?:\s|$)/ },
  { kind: "gemini", re: /(?:^|\/)gemini(?:\s|$)/ },
  { kind: "opencode", re: /(?:^|\/)opencode(?:\s|$)/ },
];

export function agentKindOf(command: string): string | null {
  for (const a of AGENTS) if (a.re.test(command)) return a.kind;
  return null;
}

/** True when `pid` descends from any pid in `roots`. */
export function descendsFrom(procs: Map<number, Proc>, pid: number, roots: Set<number>): boolean {
  let cur = procs.get(pid);
  for (let i = 0; cur && i < 64; i++) {
    if (roots.has(cur.pid)) return true;
    if (cur.ppid <= 1) return false;
    cur = procs.get(cur.ppid);
  }
  return false;
}
