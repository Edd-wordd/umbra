import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { LOG_DIR } from "./audit.js";
import { findBin, run } from "./exec.js";

/**
 * Jump links: GET http://127.0.0.1:7317/jump/<token>. A token is random,
 * single-purpose (one fixed action), and expires after 24 h. The token is the
 * auth; the action is one of four fixed kinds below, never a command.
 * Tokens persist in logs/jumps.json so a ping still works after a helper restart.
 */
export type JumpTarget =
  | { kind: "herdr"; paneId: string; label: string }
  | { kind: "cursor"; dir: string; label: string }
  | { kind: "localhost"; port: number }
  | { kind: "url"; url: string };

const TTL = 24 * 3_600_000;
const MAX = 500;
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

/** Only GitHub pages (CI runs, PRs) are redirect targets. */
export const isGithubUrl = (u: string) => /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\/[\w./?=&%#:+-]*)?$/.test(u);

export function validTarget(t: JumpTarget): boolean {
  switch (t.kind) {
    case "herdr":
      return /^[\w-]+:[\w-]+$/.test(t.paneId);
    case "cursor":
      return isAbsolute(t.dir) && !t.dir.includes("\0");
    case "localhost":
      return Number.isInteger(t.port) && t.port > 0 && t.port < 65536;
    case "url":
      return isGithubUrl(t.url);
    default:
      return false;
  }
}

export class Jumps {
  private map = new Map<string, { target: JumpTarget; exp: number }>();

  constructor(private file = join(LOG_DIR, "jumps.json")) {
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, { target: JumpTarget; exp: number }>;
      const now = Date.now();
      for (const [k, v] of Object.entries(raw)) if (TOKEN_RE.test(k) && v.exp > now && validTarget(v.target)) this.map.set(k, v);
    } catch {
      /* first run */
    }
  }

  mint(target: JumpTarget): string {
    if (!validTarget(target)) throw new Error(`invalid jump target ${target.kind}`);
    const now = Date.now();
    for (const [k, v] of this.map) if (v.exp < now) this.map.delete(k);
    while (this.map.size >= MAX) this.map.delete(this.map.keys().next().value as string);
    const token = randomBytes(18).toString("base64url");
    this.map.set(token, { target, exp: now + TTL });
    this.save();
    return token;
  }

  get(token: string): JumpTarget | undefined {
    if (!TOKEN_RE.test(token)) return undefined;
    const e = this.map.get(token);
    if (!e || e.exp < Date.now()) return undefined;
    return e.target;
  }

  private save() {
    try {
      mkdirSync(join(this.file, ".."), { recursive: true });
      writeFileSync(this.file, JSON.stringify(Object.fromEntries(this.map)), { mode: 0o600 });
    } catch (e) {
      console.error("[jump] couldn't save tokens:", (e as Error).message);
    }
  }
}

/* --- the fixed Mac actions a jump may take ---------------------------------------- */

const OPEN = existsSync("/usr/bin/open") ? "/usr/bin/open" : "open";
const dryRun = () => process.env.UMBRA_JUMP_DRYRUN === "1";

/** Run an app launcher (no shell). UMBRA_JUMP_DRYRUN=1 only reports what it would run. */
async function launch(file: string, args: string[]): Promise<{ ok: boolean; cmd: string; why?: string }> {
  const cmd = [file, ...args].join(" ");
  if (dryRun()) return { ok: true, cmd: `(dry run) ${cmd}` };
  const r = await run(file, args, { timeoutMs: 10_000 });
  return { ok: r.ok, cmd, why: r.ok ? undefined : (r.stderr || r.stdout).trim().slice(0, 160) || `exit ${r.code}` };
}

let detected: string | null = null;

/** jumpTerminalApp: explicit name, or "auto" = Ghostty when `open -Ra Ghostty` finds it, else Terminal. */
export async function terminalApp(pref: string): Promise<string> {
  if (pref && pref !== "auto") return pref;
  if (detected) return detected;
  const r = dryRun() ? { ok: false } : await run(OPEN, ["-Ra", "Ghostty"], { timeoutMs: 5000 });
  detected = r.ok ? "Ghostty" : "Terminal";
  return detected;
}

export const activateApp = (app: string) => launch(OPEN, ["-a", app]);

/** The `cursor` CLI when it's installed, else `open -a Cursor <dir>`. */
export function openInCursor(dir: string) {
  const cli = findBin("cursor");
  return cli ? launch(cli, [dir]) : launch(OPEN, ["-a", "Cursor", dir]);
}
