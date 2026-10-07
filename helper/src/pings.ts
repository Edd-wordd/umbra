import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { audit, LOG_DIR } from "./audit.js";
import { accentOf } from "./colors.js";
import type { PingsConfig } from "./config.js";
import type { HerdrStatus } from "./herdr.js";
import { deliver, type Delivery } from "./notify.js";
import { isGithubUrl, type JumpTarget, type Jumps } from "./jumps.js";
import type { CiRun, PingInfo } from "./protocol.js";

/**
 * Pings: Umbra stays out of the way and taps Edward on the shoulder (a native
 * Mac notification) only when something needs him. Few triggers on purpose;
 * each carries a reason and a jump link to the right place.
 *
 * Never twice: every ping has a dedup key (that exact event: agent pane +
 * Herdr seq, CI run id, …) remembered for 48 h across restarts, plus a
 * cooldown per subject (the same agent / port / repo). Quiet hours record the
 * ping without showing it.
 */
export type PingKind = "agent.blocked" | "agent.done" | "server.died" | "ci.failed" | "work.stale" | "test";

/** Same shape the app gets (protocol.ts). `title` has no emoji; the notification adds the project's. */
export type Ping = PingInfo & { kind: PingKind; delivery: Delivery | "quiet" };

export interface PingInput {
  kind: PingKind;
  /** This exact event (never pinged twice). */
  key: string;
  /** What it's about (cooldown applies per subject). */
  subject: string;
  repo?: string;
  title: string;
  message: string;
  reason: string;
  target?: JumpTarget;
  /** Quiet hours: try again later instead of recording it as quiet (stale work). */
  deferInQuiet?: boolean;
}

export interface AgentObs {
  pane: string;
  repo: string;
  agent: string;
  /** "ws 6" when the project has more than one Herdr workspace. */
  where?: string;
  status: HerdrStatus;
  seq: number;
  completion: number | null;
  question?: string;
  task?: string;
}

export interface ServerObs {
  port: number;
  repo: string;
  dir: string;
  pid?: number;
  command: string;
  sessionId?: string;
}

export interface StaleRow {
  repo: string;
  dir: string;
  remote: string | null;
  uncommitted: number;
  /** Last commit or index write. */
  idleSince: number;
  ahead: number;
  oldestUnpushedAt?: number;
}

const MIN = 60_000;
const DAY = 86_400_000;
const KEEP_KEYS = 2 * DAY;
const MAX_RECENT = 30;
/** CI runs older than this when first seen are history, not news. */
const CI_FRESH = 6 * 3_600_000;

const minutes = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

export function inQuietHours(q: PingsConfig["quietHours"], d: Date): boolean {
  if (!q.enabled) return false;
  const s = minutes(q.start);
  const e = minutes(q.end);
  if (Number.isNaN(s) || Number.isNaN(e) || s === e) return false;
  const t = d.getHours() * 60 + d.getMinutes();
  return s < e ? t >= s && t < e : t >= s || t < e;
}

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const who = (a: AgentObs) => `${a.agent}${a.where ? ` (${a.where})` : ""}`;


export class Pings {
  readonly recent: Ping[] = [];
  private sent = new Map<string, number>();
  private last = new Map<string, number>();
  private agentsSeen = new Map<string, { status: HerdrStatus; completion: number | null }>();
  private serversSeen = new Map<number, ServerObs & { since: number }>();
  private dying = new Map<number, ServerObs & { at: number }>();
  private seq = 0;

  constructor(
    private cfg: PingsConfig,
    private jumps: Jumps,
    private baseUrl: string,
    private hooks: {
      onPing?: (p: Ping) => void;
      /** Why a vanished server's exit was expected (killed from Umbra, ctrl+c, pane closed …), or null. */
      serverExitExpected?: (s: ServerObs) => Promise<string | null>;
    } = {},
    private file = join(LOG_DIR, "pings.json"),
  ) {
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as { sent?: Record<string, number>; recent?: Ping[] };
      const now = Date.now();
      for (const [k, at] of Object.entries(raw.sent ?? {})) if (now - at < KEEP_KEYS) this.sent.set(k, at);
      this.recent.push(...(raw.recent ?? []).slice(0, MAX_RECENT));
    } catch {
      /* first run */
    }
  }

  /* --- delivery ------------------------------------------------------------------- */

  async send(i: PingInput): Promise<Ping | null> {
    const test = i.kind === "test";
    if (!test && !this.cfg.enabled) return null;
    const now = Date.now();
    if (this.sent.has(i.key)) return null;
    const quiet = !test && inQuietHours(this.cfg.quietHours, new Date(now));
    if (quiet && i.deferInQuiet) return null;
    this.sent.set(i.key, now);
    const prev = this.last.get(i.subject);
    if (!test && prev && now - prev < this.cfg.cooldownMinutes * MIN) {
      console.log(`[ping] cooldown · ${i.title}`);
      return null;
    }
    this.last.set(i.subject, now);
    const token = i.target ? this.jumps.mint(i.target) : undefined;
    const jump = token ? `${this.baseUrl}/jump/${token}` : undefined;
    const shown = i.repo ? `${accentOf(i.repo).emoji} ${i.title}` : i.title;
    const delivery = quiet ? "quiet" : await deliver({ title: shown, subtitle: i.reason, message: i.message, url: jump, group: `umbra.${i.subject}` }, this.cfg);
    const ping: Ping = { id: `ping-${now.toString(36)}-${++this.seq}`, at: now, kind: i.kind, repo: i.repo, title: i.title, message: i.message, reason: i.reason, jump, target: i.target?.kind, delivery };
    this.recent.unshift(ping);
    this.recent.length = Math.min(this.recent.length, MAX_RECENT);
    this.save();
    audit({ action: "ping", result: "info", kind: i.kind, repo: i.repo, reason: i.reason, title: i.title, delivery, jump: i.target?.kind });
    console.log(`[ping] ${delivery} · ${i.title} · ${i.message}${jump ? ` · ${jump}` : ""}`);
    this.hooks.onPing?.(ping);
    return ping;
  }

  private save() {
    const now = Date.now();
    for (const [k, at] of this.sent) if (now - at > KEEP_KEYS) this.sent.delete(k);
    try {
      mkdirSync(join(this.file, ".."), { recursive: true });
      writeFileSync(this.file, JSON.stringify({ sent: Object.fromEntries(this.sent), recent: this.recent }), { mode: 0o600 });
    } catch (e) {
      console.error("[ping] couldn't save state:", (e as Error).message);
    }
  }

  /* --- triggers ------------------------------------------------------------------- */

  /** Every Herdr snapshot: blocked (any time, including at startup) and finished (needs a previous look). */
  agents(list: AgentObs[]) {
    const live = new Set<string>();
    for (const a of list) {
      live.add(a.pane);
      const prev = this.agentsSeen.get(a.pane);
      this.agentsSeen.set(a.pane, { status: a.status, completion: a.completion });
      const target: JumpTarget = { kind: "herdr", paneId: a.pane, label: `${a.repo} · ${who(a)}` };
      if (this.cfg.agentBlocked && a.status === "blocked" && prev?.status !== "blocked") {
        void this.send({
          kind: "agent.blocked",
          key: `blocked:${a.pane}:${a.seq}`,
          subject: `blocked:${a.pane}`,
          repo: a.repo,
          title: `${a.repo} · ${who(a)} needs you`,
          message: a.question || `${a.agent} is waiting on a dialog`,
          reason: "agent waiting on you",
          target,
        });
      }
      if (!prev || !this.cfg.agentDone || (a.status !== "done" && a.status !== "idle")) continue;
      const advanced = a.completion !== null && a.completion !== prev.completion;
      if ((prev.status === "working" && a.status === "done") || advanced) {
        void this.send({
          kind: "agent.done",
          key: `done:${a.pane}:${a.completion ?? a.seq}`,
          subject: `done:${a.pane}`,
          repo: a.repo,
          title: `${a.repo} · ${who(a)} finished`,
          message: a.task ? `“${a.task}” · ready for you` : "ready for review",
          reason: "agent finished",
          target,
        });
      }
    }
    for (const pane of [...this.agentsSeen.keys()]) if (!live.has(pane)) this.agentsSeen.delete(pane);
  }

  /**
   * Every port scan (project servers that are listening). A server that has
   * been up a while and vanishes gets a grace period: back on the same port →
   * ping with localhost, still gone → ping with the project in Cursor.
   * Returns ms until the caller should scan again for a verdict, or null.
   */
  servers(list: ServerObs[], now = Date.now()): number | null {
    const cur = new Map(list.map((s) => [s.port, s]));
    for (const [port, s] of this.serversSeen) {
      if (!cur.has(port) && now - s.since >= this.cfg.serverMinUpSeconds * 1000 && !this.dying.has(port)) this.dying.set(port, { ...s, at: now });
    }
    const seen = new Map<number, ServerObs & { since: number }>();
    for (const s of list) {
      const old = this.serversSeen.get(s.port);
      seen.set(s.port, { ...s, since: old && old.pid === s.pid && old.repo === s.repo ? old.since : now });
    }
    this.serversSeen = seen;
    let wait: number | null = null;
    for (const [port, d] of this.dying) {
      const back = cur.get(port);
      const left = d.at + this.cfg.serverGraceSeconds * 1000 - now;
      if (back && back.repo === d.repo) {
        this.dying.delete(port);
        void this.serverDied(d, back);
      } else if (left <= 0) {
        this.dying.delete(port);
        void this.serverDied(d, null);
      } else wait = Math.min(wait ?? left, left);
    }
    return wait;
  }

  private async serverDied(d: ServerObs & { at: number }, back: ServerObs | null) {
    if (!this.cfg.serverDied) return;
    const why = await this.hooks.serverExitExpected?.(d);
    if (why) {
      console.log(`[ping] :${d.port} (${d.repo}) stopped · expected (${why}) · no ping`);
      return;
    }
    void this.send({
      kind: "server.died",
      key: `server:${d.repo}:${d.port}:${d.at}`,
      subject: `server:${d.repo}:${d.port}`,
      repo: d.repo,
      title: `${d.repo} · :${d.port} ${back ? "restarted" : "went down"}`,
      message: back ? `${d.command} died and came back · open localhost:${d.port}` : `${d.command} stopped listening · open the project in Cursor`,
      reason: "dev server died",
      target: back ? { kind: "localhost", port: d.port } : { kind: "cursor", dir: d.dir, label: d.repo },
    });
  }

  /** Every CI poll: the latest run failed (and it's recent). */
  ci(run: CiRun, dir: string) {
    if (!this.cfg.ciFailed || run.status !== "failed" || Date.now() - run.at > CI_FRESH) return;
    void this.send({
      kind: "ci.failed",
      key: `ci:${run.id}`,
      subject: `ci:${run.repo}`,
      repo: run.repo,
      title: `${run.repo} · CI failed`,
      message: `${run.summary}${run.failing[0] ? ` · ${run.failing[0]}` : ""} · ${run.branch}`,
      reason: "CI failed on the latest run",
      target: run.url && isGithubUrl(run.url) ? { kind: "url", url: run.url } : { kind: "cursor", dir, label: run.repo },
    });
  }

  /** Every git scan (cheap: the key is per day). Repos without a remote can't push, so only uncommitted counts there. */
  staleWork(rows: StaleRow[], now = Date.now()) {
    if (!this.cfg.enabled || !this.cfg.staleWork) return;
    const cutoff = now - this.cfg.staleWorkDays * DAY;
    const hits = rows.flatMap((r) => {
      const why: string[] = [];
      if (r.uncommitted > 0 && r.idleSince < cutoff) why.push(`${r.uncommitted} uncommitted`);
      if (r.remote && r.ahead > 0 && r.oldestUnpushedAt !== undefined && r.oldestUnpushedAt < cutoff) why.push(`${r.ahead} unpushed`);
      return why.length ? [{ r, why }] : [];
    });
    if (!hits.length) return;
    const oldest = hits.sort((a, b) => Math.min(a.r.idleSince, a.r.oldestUnpushedAt ?? Infinity) - Math.min(b.r.idleSince, b.r.oldestUnpushedAt ?? Infinity))[0].r;
    void this.send({
      kind: "work.stale",
      key: `stale:${localDay(new Date(now))}`,
      subject: "stale",
      repo: oldest.repo,
      title: `${oldest.repo}${hits.length > 1 ? ` +${hits.length - 1}` : ""} · work left behind`,
      message: hits.map(({ r, why }) => `${r.repo} ${why.join(", ")}`).join(" · "),
      reason: `uncommitted or unpushed for more than ${this.cfg.staleWorkDays}d`,
      target: { kind: "cursor", dir: oldest.dir, label: oldest.repo },
      deferInQuiet: true,
    });
  }
}
