import { spawn as spawnChild, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import type { AgentPrompt, AgentSession, HelperEvent, TermLine, TermLineKind, TermSession } from "./protocol.js";

/**
 * Helper-owned terminals: the FALLBACK path. With Herdr running, agents and
 * panes live in Herdr and Umbra reads/writes them through Herdr's API. These
 * sessions cover "+ shell", "run tests" and (Herdr off) "send to agent".
 *
 * Backends (config `pty`):
 *  - script  PTY via /usr/bin/script (ships with macOS; no native build)
 *  - pipe    plain pipes (no TTY: fine for scripts, TUIs won't run)
 */
export type PtyMode = "script" | "pipe";

interface Proc {
  pid: number;
  write(data: string): void;
  kill(signal?: NodeJS.Signals): void;
  onData(cb: (d: string) => void): void;
  onExit(cb: (code: number | null, signal: string | null) => void): void;
}

export function choosePtyMode(pref: "auto" | PtyMode): { mode: PtyMode; note: string } {
  if (pref === "pipe") return { mode: "pipe", note: "pipes (config)" };
  if (existsSync("/usr/bin/script")) return { mode: "script", note: "script(1) pty" };
  return { mode: "pipe", note: "pipes (no pty)" };
}

const shq = (s: string) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

function spawnProc(mode: PtyMode, file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Proc {
  let child: ChildProcess;
  if (mode === "script") {
    const argv =
      process.platform === "darwin"
        ? ["-q", "/dev/null", file, ...args]
        : ["-qfec", [file, ...args].map(shq).join(" "), "/dev/null"];
    child = spawnChild("/usr/bin/script", argv, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
  } else {
    child = spawnChild(file, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
  }
  return {
    pid: child.pid ?? 0,
    write: (d) => child.stdin?.write(d),
    kill: (s) => child.kill(s),
    onData: (cb) => {
      child.stdout?.on("data", (b: Buffer) => cb(b.toString("utf8")));
      child.stderr?.on("data", (b: Buffer) => cb(b.toString("utf8")));
    },
    onExit: (cb) => {
      child.on("exit", (code, signal) => cb(code, signal));
      child.on("error", () => cb(127, null));
    },
  };
}

/* --- text normalisation ------------------------------------------------------ */

// CSI, OSC, DCS/APC, 2-byte escapes, other C0 controls except \t \n \r.
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[PX^_][^\x1b]*\x1b\\|\x1b[@-Z\\-_]|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
export const stripAnsi = (s: string) => s.replace(ANSI, "");

/** A line as it would look on screen after carriage returns. */
export function settle(line: string): string {
  const l = line.replace(/\r+$/, "");
  if (!l.includes("\r")) return l;
  const segs = l.split("\r").filter((s) => s.length);
  return segs.at(-1) ?? "";
}

export class LineBuffer {
  private partial = "";
  /** Feed raw output; returns completed (settled, ANSI-free) lines. */
  push(chunk: string): string[] {
    const text = this.partial + stripAnsi(chunk);
    const parts = text.split("\n");
    this.partial = parts.pop() ?? "";
    return parts.map(settle);
  }
  /** The unfinished line (e.g. a prompt waiting on input). */
  peek(): string {
    return settle(this.partial);
  }
  take(): string {
    const p = this.peek();
    this.partial = "";
    return p;
  }
}

const PROMPT_ONLY = /^\S+ ❯ ?$/;

export function kindOf(text: string): TermLineKind {
  if (/^\S+ ❯ \S/.test(text)) return "cmd";
  if (/\b(error|failed|failure|fatal|exception)\b|✕|✗|ERR!/i.test(text)) return "err";
  if (/\bwarn(ing)?\b|⚠|\[y\/n\]|\(y\/n\)|trust this/i.test(text)) return "warn";
  if (/✓|✔|\bpassed\b|\bsuccess\b|\bready\b/i.test(text)) return "ok";
  return "out";
}

/* --- prompt detection ------------------------------------------------------------ */

const PATTERNS: { re: RegExp; kind: AgentPrompt["kind"]; title: string }[] = [
  { re: /trust (?:this|the) (?:workspace|folder|directory)|do you trust/i, kind: "workspace-trust", title: "Workspace trust" },
  { re: /\[y\/n\]|\(y\/n\)|\[y\/N\]|\(y\/N\)|\[Y\/n\]|\(Y\/n\)/, kind: "confirm", title: "Confirm" },
  { re: /\bdo you want to\b|\bwould you like to\b|\ballow (?:this|once|always)\b|\bproceed\?|press enter to continue/i, kind: "confirm", title: "Confirm" },
];

export interface Detected {
  kind: AgentPrompt["kind"];
  title: string;
  detail: string;
  idle?: boolean;
}

/** Look for a prompt in what the session printed since the last input. */
export function detectPrompt(lines: string[], partial: string, idleMs: number): Detected | null {
  const recent = [...lines.slice(-8), partial].filter((l) => l.trim());
  for (let i = recent.length - 1; i >= 0; i--) {
    for (const p of PATTERNS) if (p.re.test(recent[i])) return { kind: p.kind, title: p.title, detail: recent[i].trim().slice(0, 200) };
  }
  const last = recent.at(-1) ?? "";
  if (idleMs >= 2500 && /(?:^|\s)[❯>›?]\s*$/.test(last)) return { kind: "confirm", title: "Waiting for input", detail: last.trim().slice(0, 200) || "idle at a prompt", idle: true };
  return null;
}

/** Keys to send for an approve/deny on a detected prompt. */
export function answerKeys(d: Detected, answer: "approve" | "deny"): string {
  const t = d.detail;
  if (/\[a\]/i.test(t)) return answer === "approve" ? "a" : "q";
  if (/\[y\/n\]|\(y\/n\)|\[y\/N\]|\(y\/N\)|\[Y\/n\]|\(Y\/n\)/.test(t)) return answer === "approve" ? "y\r" : "n\r";
  if (d.idle) return answer === "approve" ? "\r" : "\x1b";
  // Menu-style prompts ("1. Yes  2. No"): Enter picks the highlighted default (yes), Esc backs out.
  return answer === "approve" ? "\r" : "\x1b";
}

/* --- sessions ------------------------------------------------------------------------ */

export type SessionKind = "shell" | "agent" | "task";

interface Managed {
  id: string;
  repo: string;
  kind: SessionKind;
  meta: Omit<TermSession, "lines">;
  lines: TermLine[];
  proc: Proc;
  buf: LineBuffer;
  /** Settled lines since the last input (prompt detection window). */
  sinceInput: string[];
  lastOutputAt: number;
  agent?: AgentSession;
  detected?: Detected;
  timers: NodeJS.Timeout[];
  onExit?: (code: number | null) => void;
  exited: boolean;
}

export interface StartSpec {
  id?: string;
  repo: string;
  cwd: string;
  branch: string;
  kind: SessionKind;
  title: string;
  file: string;
  args: string[];
  agent?: { kind: string; task: string };
  onExit?: (code: number | null) => void;
}

let seq = 0;
const nid = (p: string) => `${p}${Date.now().toString(36)}${(++seq).toString(36)}`;

export class SessionManager {
  private sessions = new Map<string, Managed>();

  constructor(
    readonly mode: PtyMode,
    private emit: (ev: HelperEvent) => void,
  ) {}

  /** Pids of managed processes (to tell managed agents from found ones). */
  pids(): Set<number> {
    return new Set([...this.sessions.values()].filter((s) => !s.exited).map((s) => s.proc.pid));
  }
  has(id: string) {
    return this.sessions.has(id);
  }
  sessionForPid(pid: number): string | undefined {
    for (const s of this.sessions.values()) if (s.proc.pid === pid) return s.id;
    return undefined;
  }
  snapshot(): { sessions: TermSession[]; agents: AgentSession[] } {
    const list = [...this.sessions.values()];
    return { sessions: list.map((s) => ({ ...s.meta, lines: s.lines })), agents: list.flatMap((s) => (s.agent ? [s.agent] : [])) };
  }
  agentById(id: string) {
    return [...this.sessions.values()].find((s) => s.agent?.id === id);
  }

  start(spec: StartSpec): Managed {
    const id = spec.id && !this.sessions.has(spec.id) ? spec.id : nid("m-");
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TERM: this.mode === "pipe" ? "dumb" : "xterm-256color",
      NO_COLOR: "1",
      BASH_SILENCE_DEPRECATION_WARNING: "1",
      PS1: "\\W ❯ ",
      UMBRA_SESSION: id,
    };
    const meta = { id, title: spec.title, cwd: spec.cwd, branch: spec.branch, managed: true };
    let proc: Proc;
    try {
      proc = spawnProc(this.mode, spec.file, spec.args, spec.cwd, env);
    } catch (e) {
      this.emit({ type: "session.upsert", session: meta, lines: [] });
      const m = this.fake(meta, spec);
      this.append(m, [{ kind: "err", text: `✕ could not start ${spec.file}: ${(e as Error).message}` }]);
      return m;
    }
    const m: Managed = {
      id,
      repo: spec.repo,
      kind: spec.kind,
      meta,
      lines: [],
      proc,
      buf: new LineBuffer(),
      sinceInput: [],
      lastOutputAt: Date.now(),
      timers: [],
      onExit: spec.onExit,
      exited: false,
    };
    if (spec.agent) {
      m.agent = {
        id: nid("ag-"),
        repo: spec.repo,
        agent: spec.agent.kind,
        branch: spec.branch,
        cwd: spec.cwd,
        task: spec.agent.task,
        state: "running",
        startedAt: Date.now(),
        sessionId: id,
        managed: true,
        pid: proc.pid,
      };
    }
    this.sessions.set(id, m);
    this.emit({ type: "session.upsert", session: meta, lines: [] });
    if (m.agent) this.emit({ type: "agent.upsert", agent: m.agent });
    this.append(m, [{ kind: "sys", text: `${spec.kind === "shell" ? "shell" : spec.file.split("/").pop()} · ${this.mode} · pid ${proc.pid}` }]);

    proc.onData((d) => this.onData(m, d));
    proc.onExit((code, signal) => this.onExit(m, code, signal));
    return m;
  }

  private fake(meta: Omit<TermSession, "lines">, spec: StartSpec): Managed {
    const m: Managed = {
      id: meta.id,
      repo: spec.repo,
      kind: spec.kind,
      meta,
      lines: [],
      proc: { pid: 0, write() {}, kill() {}, onData() {}, onExit() {} },
      buf: new LineBuffer(),
      sinceInput: [],
      lastOutputAt: Date.now(),
      timers: [],
      exited: true,
    };
    this.sessions.set(meta.id, m);
    return m;
  }

  private append(m: Managed, lines: { kind: TermLineKind; text: string }[]) {
    if (!lines.length) return;
    const at = Date.now();
    const ls: TermLine[] = lines.map((l) => ({ id: nid("l"), at, kind: l.kind, text: l.text.slice(0, 800) }));
    m.lines.push(...ls);
    if (m.lines.length > 400) m.lines.splice(0, m.lines.length - 400);
    this.emit({ type: "term.append", sessionId: m.id, lines: ls });
  }

  private onData(m: Managed, d: string) {
    m.lastOutputAt = Date.now();
    const done = m.buf.push(d);
    const out: { kind: TermLineKind; text: string }[] = [];
    let blank = 0;
    for (const t of done) {
      m.sinceInput.push(t);
      if (PROMPT_ONLY.test(t.trim())) continue;
      if (!t.trim()) {
        if (++blank > 1) continue;
      } else blank = 0;
      out.push({ kind: kindOf(t), text: t });
    }
    if (m.sinceInput.length > 50) m.sinceInput.splice(0, m.sinceInput.length - 50);
    this.append(m, out);
    // Unfinished line (a prompt without newline): show it once things go quiet.
    for (const t of m.timers) clearTimeout(t);
    m.timers = [
      setTimeout(() => this.flushPartial(m), 250),
      setTimeout(() => this.check(m), 300),
      setTimeout(() => this.check(m), 2700),
    ];
  }

  private flushPartial(m: Managed) {
    const p = m.buf.peek();
    if (!p.trim() || PROMPT_ONLY.test(p.trim())) return;
    m.buf.take();
    m.sinceInput.push(p);
    this.append(m, [{ kind: kindOf(p), text: p }]);
  }

  private check(m: Managed) {
    if (!m.agent || m.exited) return;
    const d = detectPrompt(m.sinceInput, m.buf.peek(), Date.now() - m.lastOutputAt);
    if (!d) return;
    if (m.agent.state === "waiting" && m.detected?.detail === d.detail) return;
    m.detected = d;
    m.agent = { ...m.agent, state: "waiting", prompt: { id: nid("p-"), kind: d.kind, title: d.title, detail: d.detail } };
    this.emit({ type: "agent.upsert", agent: m.agent });
    this.append(m, [{ kind: "warn", text: `⌛ waiting for you · ${d.title.toLowerCase()} · approve or deny under needs you` }]);
  }

  private onExit(m: Managed, code: number | null, signal: string | null) {
    if (m.exited) return;
    m.exited = true;
    for (const t of m.timers) clearTimeout(t);
    const tail = m.buf.take();
    if (tail.trim()) this.append(m, [{ kind: kindOf(tail), text: tail }]);
    this.append(m, [{ kind: code === 0 ? "dim" : "err", text: `process exited · ${signal ? `signal ${signal}` : `code ${code}`}` }]);
    if (m.agent) {
      const state = code === 0 ? "done" : signal ? "stopped" : "failed";
      m.agent = {
        ...m.agent,
        state,
        prompt: undefined,
        endedAt: Date.now(),
        ...(state === "failed" ? { failure: { summary: `exited with code ${code}`, tests: [] } } : {}),
      } as AgentSession;
      this.emit({ type: "agent.upsert", agent: m.agent });
    }
    m.onExit?.(code);
  }

  /** Write a command line (Enter appended). In pipe mode there is no echo, so echo it here. */
  exec(id: string, command: string): { ok: boolean; why?: string } {
    const m = this.sessions.get(id);
    if (!m) return { ok: false, why: "not a managed session" };
    if (m.exited) return { ok: false, why: "session has exited" };
    if (command === "^C") {
      m.proc.write("\x03");
      return { ok: true };
    }
    if (this.mode === "pipe" || m.kind !== "shell") this.append(m, [{ kind: "cmd", text: `${m.repo} ❯ ${command}` }]);
    this.input(m);
    m.proc.write(command + (this.mode === "pipe" ? "\n" : "\r"));
    return { ok: true };
  }

  respond(agentId: string, promptId: string, answer: "approve" | "deny"): { ok: boolean; why?: string } {
    const m = this.agentById(agentId);
    if (!m?.agent || m.exited) return { ok: false, why: "no such managed agent" };
    if (!m.detected || m.agent.prompt?.id !== promptId) return { ok: false, why: "prompt no longer showing" };
    const keys = answerKeys(m.detected, answer);
    this.append(m, [{ kind: "dim", text: `${answer === "approve" ? "✓ approved" : "✕ denied"} from Umbra · sent ${JSON.stringify(keys)}` }]);
    this.input(m);
    m.proc.write(keys);
    return { ok: true };
  }

  private input(m: Managed) {
    m.sinceInput = [];
    // Keep a shell's pending prompt so its echo lands on the same line ("umbra ❯ ls").
    if (m.kind !== "shell") m.buf.take();
    m.detected = undefined;
    if (m.agent && m.agent.state === "waiting") {
      m.agent = { ...m.agent, state: "running", prompt: undefined };
      this.emit({ type: "agent.upsert", agent: m.agent });
    }
  }

  clear(id: string) {
    const m = this.sessions.get(id);
    if (!m) return;
    m.lines = [];
    this.emit({ type: "term.clear", sessionId: id });
  }

  stopAll() {
    for (const m of this.sessions.values()) if (!m.exited) m.proc.kill("SIGTERM");
  }
}
