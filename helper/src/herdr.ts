import { existsSync } from "node:fs";
import { createConnection, type Socket } from "node:net";
import { BIN_DIRS, run } from "./exec.js";

/**
 * Herdr client (terminal workspace manager for coding agents, protocol 22).
 *
 * Two transports with the same calls:
 *  - socket: newline-delimited JSON on ~/.config/herdr/herdr.sock, one request per connection
 *            → {id, method, params}  ← {id, result} | {id, error:{code,message}}
 *            plus a second connection for `events.subscribe`.
 *  - cli:    the `herdr` binary (prints the same {id, result} envelopes).
 * `auto` pings the socket and falls back to the CLI. Shapes follow
 * `herdr api schema --json` (captured from Edward's Mac, v0.9.3).
 */

export type HerdrStatus = "idle" | "working" | "blocked" | "done" | "unknown";

export interface HWorkspace {
  workspace_id: string;
  label: string;
  number: number;
  focused: boolean;
  agent_status: HerdrStatus;
  pane_count: number;
  tab_count: number;
  active_tab_id: string;
}

export interface HPane {
  pane_id: string;
  tab_id: string;
  workspace_id: string;
  terminal_id: string;
  agent?: string | null;
  agent_status: HerdrStatus;
  cwd?: string | null;
  foreground_cwd?: string | null;
  focused: boolean;
  revision: number;
  terminal_title?: string | null;
  terminal_title_stripped?: string | null;
}

export interface HAgent extends HPane {
  name?: string | null;
  display_agent?: string | null;
  state_change_seq?: number;
  completion_seq?: number | null;
  screen_detection_skipped?: boolean;
}

export interface HSnapshot {
  version: string;
  protocol: number;
  workspaces: HWorkspace[];
  panes: HPane[];
  agents: HAgent[];
  focused_pane_id?: string | null;
  focused_workspace_id?: string | null;
}

export interface HProcessInfo {
  pane_id: string;
  shell_pid?: number | null;
  foreground_processes?: { pid: number; name: string; cmdline?: string | null; cwd?: string | null }[];
}

export class HerdrError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface HerdrConfig {
  /** auto = socket if it answers ping, else CLI; off = don't use Herdr. */
  transport: "auto" | "socket" | "cli" | "off";
  socket: string;
  bin: string;
}

type Envelope = { id?: string; result?: Record<string, unknown>; error?: { code: string; message: string } };

const findBin = (bin: string) => {
  if (bin.includes("/")) return bin;
  const home = process.env.HOME ?? "";
  for (const d of [`${home}/.local/bin`, ...BIN_DIRS]) if (existsSync(`${d}/${bin}`)) return `${d}/${bin}`;
  return bin;
};

let reqSeq = 0;

/**
 * NDJSON request/response over the Herdr socket. Real Herdr (0.9.3, protocol 22)
 * answers exactly one request per connection and then ends it, so every call
 * opens its own short-lived connection (parallel calls are fine).
 */
class SocketTransport {
  private open = new Set<Socket>();

  constructor(private path: string) {}

  call(method: string, params: Record<string, unknown>, timeoutMs = 5000): Promise<Envelope> {
    const id = `umbra:${++reqSeq}`;
    return new Promise((resolve) => {
      let done = false;
      let buf = "";
      const s = createConnection(this.path);
      this.open.add(s);
      const finish = (env: Envelope) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.open.delete(s);
        s.destroy();
        resolve(env);
      };
      const timer = setTimeout(() => finish({ id, error: { code: "timeout", message: `${method} timed out` } }), timeoutMs);
      s.setEncoding("utf8");
      s.once("connect", () => s.write(JSON.stringify({ id, method, params }) + "\n"));
      s.on("data", (d: string) => {
        buf += d;
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          try {
            const env = JSON.parse(line) as Envelope;
            if (env.id === id) return finish(env);
          } catch {
            /* ignore non-JSON */
          }
        }
      });
      s.on("end", () => {
        // A reply without a trailing newline still counts.
        const line = buf.trim();
        if (line) {
          try {
            const env = JSON.parse(line) as Envelope;
            if (env.id === id) return finish(env);
          } catch {
            /* fall through */
          }
        }
        finish({ id, error: { code: "socket_closed", message: "herdr closed the connection without a reply" } });
      });
      s.on("error", (e) => finish({ id, error: { code: "socket_error", message: e.message } }));
    });
  }

  close() {
    for (const s of this.open) s.destroy();
    this.open.clear();
  }
}

export class Herdr {
  mode: "socket" | "cli" | "off" = "off";
  note = "not checked";
  version = "";
  private sock: SocketTransport | null = null;
  private sub: Socket | null = null;
  private bin: string;

  constructor(private cfg: HerdrConfig) {
    this.bin = findBin(cfg.bin);
  }

  async init(): Promise<void> {
    if (this.cfg.transport === "off") {
      this.mode = "off";
      this.note = "disabled in config";
      return;
    }
    if (this.cfg.transport !== "cli" && existsSync(this.cfg.socket)) {
      const t = new SocketTransport(this.cfg.socket);
      try {
        const r = await t.call("ping", {}, 2000);
        if (r.result?.type === "pong") {
          this.sock = t;
          this.mode = "socket";
          this.version = String(r.result.version ?? "");
          this.note = `socket · v${this.version} · protocol ${r.result.protocol}`;
          return;
        }
      } catch {
        /* fall through to CLI */
      }
      t.close();
    }
    if (this.cfg.transport === "socket") {
      this.mode = "off";
      this.note = `socket ${this.cfg.socket} not answering`;
      return;
    }
    const v = await this.cli(["api", "snapshot"], 5000);
    if (v.result?.type === "session_snapshot") {
      this.mode = "cli";
      const snap = v.result.snapshot as HSnapshot;
      this.version = snap.version;
      this.note = `cli · v${snap.version} · protocol ${snap.protocol}`;
    } else {
      this.mode = "off";
      this.note = !v.error
        ? "herdr not running"
        : v.error.code === "unavailable"
          ? `herdr not found (${this.bin}) and no socket at ${this.cfg.socket}`
          : `herdr not running · ${v.error.message}`.slice(0, 140);
    }
  }

  private async cli(args: string[], timeoutMs = 8000): Promise<Envelope> {
    const r = await run(this.bin, args, { timeoutMs });
    const text = (r.ok ? r.stdout : r.stderr || r.stdout).trim();
    try {
      return JSON.parse(text) as Envelope;
    } catch {
      if (r.ok) return { result: { type: "text", text: r.stdout } };
      return { error: { code: r.code === 127 || r.code === null ? "unavailable" : "cli_error", message: text.split("\n")[0] || `herdr exited ${r.code}` } };
    }
  }

  /** Same request either way: socket method + params, or the equivalent CLI words. */
  private async call(method: string, params: Record<string, unknown>, cliArgs: string[], timeoutMs = 8000): Promise<Record<string, unknown>> {
    if (this.mode === "off") throw new HerdrError("unavailable", "herdr is not connected");
    const env = this.mode === "socket" && this.sock ? await this.sock.call(method, params, timeoutMs) : await this.cli(cliArgs, timeoutMs);
    if (env.error) throw new HerdrError(env.error.code, env.error.message);
    return env.result ?? {};
  }

  async snapshot(): Promise<HSnapshot> {
    const r = await this.call("session.snapshot", {}, ["api", "snapshot"]);
    return r.snapshot as HSnapshot;
  }

  /** Pane output as plain text (`recent_unwrapped` by default). */
  async read(paneId: string, lines = 160, source: "recent_unwrapped" | "visible" | "detection" | "recent" = "recent_unwrapped"): Promise<string> {
    const r = await this.call("pane.read", { pane_id: paneId, source, lines, format: "text", strip_ansi: true }, [
      "pane",
      "read",
      paneId,
      "--source",
      source.replace("_", "-"),
      "--lines",
      String(lines),
    ]);
    const read = r.read as { text?: string } | undefined;
    return read?.text ?? (typeof r.text === "string" ? r.text : "");
  }

  /** Logical keys to the agent in a pane (validated by Herdr before any byte is written). */
  async agentKeys(target: string, keys: string[]) {
    await this.call("agent.send_keys", { target, keys }, ["agent", "send-keys", target, ...keys]);
  }

  /** Text + Enter as one submission; Herdr refuses if the agent is blocked. */
  async prompt(target: string, text: string) {
    await this.call("agent.prompt", { target, text }, ["agent", "prompt", target, text], 15000);
  }

  /** Raw terminal input: text then keys (e.g. a shell command + Enter). */
  async paneInput(paneId: string, text: string, keys: string[] = ["enter"]) {
    await this.call("pane.send_input", { pane_id: paneId, text, keys }, keys.length === 1 && keys[0] === "enter" ? ["pane", "run", paneId, text] : ["pane", "send-text", paneId, text]);
  }

  async paneKeys(paneId: string, keys: string[]) {
    await this.call("pane.send_keys", { pane_id: paneId, keys }, ["pane", "send-keys", paneId, ...keys]);
  }

  async focus(paneId: string, isAgent: boolean) {
    if (isAgent) await this.call("agent.focus", { target: paneId }, ["agent", "focus", paneId]);
    else await this.call("pane.focus", { pane_id: paneId }, ["pane", "focus", paneId]);
  }

  async processInfo(paneId: string): Promise<HProcessInfo | null> {
    try {
      const r = await this.call("pane.process_info", { pane_id: paneId }, ["pane", "process-info", paneId], 4000);
      return (r.process_info as HProcessInfo) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Live updates (socket only): any workspace/pane/agent change calls `onChange`.
   * Returns false when subscriptions aren't available (the caller keeps polling).
   */
  subscribe(paneIds: string[], onChange: (event: string, data: unknown) => void, onClose: () => void): boolean {
    if (this.mode !== "socket") return false;
    this.sub?.destroy();
    const s = createConnection(this.cfg.socket);
    s.setEncoding("utf8");
    let buf = "";
    const subscriptions = [
      ...["workspace.created", "workspace.closed", "workspace.renamed", "workspace.updated", "pane.created", "pane.closed", "pane.exited", "pane.agent_detected", "pane.updated"].map((type) => ({ type })),
      ...paneIds.map((pane_id) => ({ type: "pane.agent_status_changed", pane_id })),
    ];
    s.on("connect", () => s.write(JSON.stringify({ id: `umbra:sub:${++reqSeq}`, method: "events.subscribe", params: { subscriptions } }) + "\n"));
    s.on("data", (d: string) => {
      buf += d;
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as { event?: string; data?: unknown; error?: unknown };
          if (msg.event) onChange(msg.event, msg.data);
        } catch {
          /* ignore */
        }
      }
    });
    s.on("error", () => s.destroy());
    s.on("close", () => {
      if (this.sub === s) this.sub = null;
      onClose();
    });
    this.sub = s;
    return true;
  }

  close() {
    this.sub?.destroy();
    this.sock?.close();
  }
}

/* --- interpretation helpers ------------------------------------------------------ */

const DETAIL_SKIP = /^[\s─━│┃╭╮╰╯┌┐└┘═║╔╗╚╝▔▁·•…-]*$/;

/** The last meaningful lines of a pane (box-drawing and blanks dropped). */
export function lastLines(text: string, n = 8): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/[│┃║]/g, " ").replace(/\s+$/, ""))
    .filter((l) => l.trim() && !DETAIL_SKIP.test(l))
    .slice(-n);
}

/** Pick the question line in a blocked agent's dialog. */
export function questionLine(lines: string[]): string {
  const q = [...lines].reverse().find((l) => /\?|\[y\/n\]|\(y\/n\)|trust|allow|approve|permission|proceed|continue/i.test(l));
  return (q ?? lines.at(-1) ?? "needs your answer").trim();
}

/**
 * Keys for approve / deny on a blocked dialog (Herdr logical key names).
 * [a]/[q] style → a / q · y/n prompts → y|n + enter · menus ("1. Yes") → enter / esc.
 */
export function approvalKeys(dialog: string, answer: "approve" | "deny"): string[] {
  if (/\[a\]/i.test(dialog)) return [answer === "approve" ? "a" : "q"];
  if (/\[y\/n\]|\(y\/n\)|\[y\/N\]|\(y\/N\)|\[Y\/n\]|\(Y\/n\)/.test(dialog)) return [answer === "approve" ? "y" : "n", "enter"];
  return [answer === "approve" ? "enter" : "esc"];
}
