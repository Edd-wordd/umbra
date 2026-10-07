import { existsSync, realpathSync, watch, type FSWatcher } from "node:fs";
import { hostname } from "node:os";
import { basename } from "node:path";
import { ghState, latestRun, openPrCount, type GhState } from "./ci.js";
import { audit } from "./audit.js";
import { projectPath, type HelperConfig, type ProjectConfig } from "./config.js";
import { readGit, type GitState } from "./git.js";
import { Herdr, HerdrError, approvalKeys, lastLines, questionLine, type HAgent, type HPane, type HSnapshot, type HerdrStatus } from "./herdr.js";
import { Approvals, riskOf } from "./policy.js";
import { agentKindOf, cwdsOf, descendsFrom, isDevLike, listListeners, listProcs, shortCommand, type Proc } from "./procs.js";
import { deriveProjects } from "./projects.js";
import type { AgentSession, AgentState, CiRun, DevServer, Handoff, HelperEvent, ProjectInfo, RecentProject, Snapshot, TermLine, TermSession, WireRequest } from "./protocol.js";
import { SessionManager, kindOf, type PtyMode } from "./sessions.js";

export const VERSION = "0.2.0";
const H = 3_600_000;

interface Project {
  repo: string;
  dir: string;
  label?: string;
  workspaces: string[];
  agentStatus?: HerdrStatus;
  services: string[];
  dev?: ProjectConfig["dev"];
  test?: string;
}

type SessionMeta = Omit<TermSession, "lines">;

const fmtUp = (s: number) => (s >= 86400 ? `${Math.floor(s / 86400)}d` : s >= 3600 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 60)}m`);
const ago = (ms: number) => fmtUp(Math.max(0, Math.floor(ms / 1000)));
const paneOf = (sessionId: string) => (sessionId.startsWith("pane:") ? sessionId.slice(5) : null);
const STATE: Record<HerdrStatus, AgentState> = { working: "running", blocked: "waiting", done: "done", idle: "idle", unknown: "idle" };
const MAX_WATCHED = 4;

/**
 * The helper's model of Edward's Mac + everything it does.
 *
 * Projects and agents come from Herdr (the terminal workspace manager his
 * agents run in); ports from lsof; git per project; CI from gh. When Herdr
 * isn't running it falls back to `fallbackProjects` and process scanning.
 * Requests from the app come through `handle()` and pass the policy first.
 */
export class Helper {
  projects: Project[] = [];
  recent: RecentProject[] = [];
  readonly sessions: SessionManager;
  readonly approvals = new Approvals();
  readonly herdr: Herdr;
  private hsnap: HSnapshot | null = null;
  private herdrFails = 0;
  private herdrBusy = false;
  private herdrKick: NodeJS.Timeout | null = null;
  private subscribedPanes = "";
  private agents = new Map<string, { agent: AgentSession; seq: number; firstSeen: number }>();
  private paneSessions = new Map<string, SessionMeta>();
  private paneLines = new Map<string, TermLine[]>();
  private watched = new Map<string, { timer: NodeJS.Timeout; last: string }>();
  private paneShells = new Map<number, string>();
  private paneShellsAt = 0;
  private listeners = new Set<(ev: HelperEvent) => void>();
  private servers: DevServer[] = [];
  private external = new Map<number, { agent: AgentSession; session: SessionMeta; lines: TermLine[]; goneAt?: number }>();
  private git = new Map<string, GitState>();
  private ci = new Map<string, CiRun>();
  private prs = new Map<string, number>();
  private gh: GhState = { available: false, authed: false, note: "unknown · checking gh" };
  private watchers = new Map<string, FSWatcher[]>();
  private timers: NodeJS.Timeout[] = [];
  private gitTimers = new Map<string, NodeJS.Timeout>();
  private scanning = false;
  private myUid = process.getuid?.() ?? -1;
  hiddenListeners = 0;

  constructor(
    readonly config: HelperConfig,
    readonly ptyMode: { mode: PtyMode; note: string },
  ) {
    this.sessions = new SessionManager(ptyMode.mode, (ev) => this.emit(ev));
    this.herdr = new Herdr(config.herdr);
  }

  /* --- events --------------------------------------------------------------- */

  subscribe(fn: (ev: HelperEvent) => void) {
    this.listeners.add(fn);
    if (this.listeners.size === 1) void this.scanProcs();
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) this.unwatchAll();
    };
  }
  get clients() {
    return this.listeners.size;
  }
  private emit(ev: HelperEvent) {
    for (const fn of this.listeners) fn(ev);
  }
  private notice(text: string, result: "ok" | "denied" | "error" | "info" | "pending" = "info") {
    this.emit({ type: "notice", text, result });
  }

  info() {
    return {
      name: "umbra-helper",
      version: VERSION,
      hostname: hostname().replace(/\.local$/, ""),
      platform: process.platform,
      pty: this.ptyMode.mode,
      gh: this.gh.authed ? "ok" : this.gh.note,
      herdr: this.herdr.mode === "off" ? `off · ${this.herdr.note}` : this.herdr.note,
      projects: this.projects.length,
      agents: this.agents.size,
    };
  }

  snapshot(): Snapshot {
    const managed = this.sessions.snapshot();
    const ext = [...this.external.values()];
    const sessions: Record<string, TermSession> = {};
    for (const [id, meta] of this.paneSessions) sessions[id] = { ...meta, lines: this.paneLines.get(id) ?? [] };
    for (const s of managed.sessions) sessions[s.id] = s;
    for (const e of ext) sessions[e.session.id] = { ...e.session, lines: e.lines };
    const github: Record<string, unknown> = {};
    for (const p of this.projects) {
      const g = this.git.get(p.repo);
      if (g) github[p.repo] = this.gitPayload(p.repo, g);
    }
    return {
      agents: [...[...this.agents.values()].map((a) => a.agent), ...managed.agents, ...ext.map((e) => e.agent)],
      sessions,
      servers: this.servers,
      ci: [...this.ci.values()].filter((c) => this.project(c.repo)),
      services: { github },
      handoff: this.handoff(),
      projects: this.projectInfos(),
      recentProjects: this.recent,
      agentKinds: this.agentKinds(),
    };
  }

  private projectInfos(): ProjectInfo[] {
    return this.projects.map((p) => ({ repo: p.repo, path: p.dir, services: p.services, label: p.label, workspaces: p.workspaces.length ? p.workspaces : undefined, agentStatus: p.agentStatus }));
  }

  private agentKinds(): string[] {
    if (this.herdr.mode !== "off") {
      const kinds = [...new Set([...this.agents.values()].map((a) => a.agent.agent))];
      return kinds.length ? kinds : ["cursor"];
    }
    return Object.keys(this.config.agents);
  }

  private gitPayload(repo: string, g: GitState) {
    return { ...g.payload, openPrs: this.prs.get(repo) ?? 0, ciNote: g.github && !this.gh.authed ? this.gh.note : undefined };
  }

  private handoff(): Snapshot["handoff"] {
    const now = Date.now();
    const rows = this.projects
      .flatMap((p) => {
        const g = this.git.get(p.repo);
        return g ? [{ p, g }] : [];
      })
      .sort((a, b) => b.g.activityAt - a.g.activityAt)
      .slice(0, 4);
    const items: Handoff[] = rows.map(({ p, g }) => {
      const x = g.payload;
      const agents = [...this.agents.values()].map((a) => a.agent).filter((a) => a.repo === p.repo);
      const busy = agents.find((a) => a.state === "running" || a.state === "waiting");
      const ci = this.ci.get(p.repo);
      const unbacked = (!x.remote && x.ahead > 0) || (x.ahead > 0 && x.oldestUnpushedAt !== undefined && now - x.oldestUnpushedAt > 24 * H);
      const work = busy ? `${busy.agent} ${busy.state === "waiting" ? "waiting on you" : "working"}${busy.task ? ` · “${busy.task.slice(0, 48)}”` : ""} · ` : "";
      return {
        repo: p.repo,
        branch: x.branch,
        summary: `${work}${x.uncommitted ? `${x.uncommitted} uncommitted · ` : ""}“${x.lastCommit.message.slice(0, 60)}” ${ago(now - x.lastCommit.at)} ago`,
        tone: ci?.status === "failed" ? "broken" : busy?.state === "waiting" ? "attention" : busy ? "active" : unbacked ? "attention" : "mid",
      };
    });
    return { at: rows[0]?.g.activityAt || now, items };
  }

  /* --- lifecycle ------------------------------------------------------------------ */

  async start() {
    await this.herdr.init();
    if (this.herdr.mode !== "off") await this.refreshHerdr();
    else this.setProjects(this.fallbackProjects());
    void this.refreshGh().then(() => this.scanCi());
    const { herdrSeconds, procSeconds, gitSeconds, ciSeconds } = this.config.poll;
    let tick = 0;
    let herdrTick = 0;
    this.timers.push(
      setInterval(() => {
        // Full speed while the app is connected; a slow heartbeat otherwise.
        if (this.clients > 0 || ++tick % 12 === 0) void this.scanProcs();
      }, procSeconds * 1000),
      setInterval(() => {
        if (this.herdr.mode !== "off") {
          if (this.clients > 0 || ++herdrTick % 5 === 0) void this.refreshHerdr();
        } else if (++herdrTick % Math.max(1, Math.round(15 / herdrSeconds)) === 0) void this.retryHerdr();
      }, herdrSeconds * 1000),
      setInterval(() => void this.scanAllGit(), gitSeconds * 1000),
      setInterval(() => void this.scanCi(), ciSeconds * 1000),
      setInterval(() => void this.refreshGh(), 10 * 60_000),
    );
  }

  stop() {
    for (const t of this.timers) clearInterval(t);
    for (const ws of this.watchers.values()) for (const w of ws) w.close();
    this.unwatchAll();
    this.herdr.close();
    this.sessions.stopAll();
  }

  /* --- Herdr ------------------------------------------------------------------------ */

  private async retryHerdr() {
    await this.herdr.init();
    if (this.herdr.mode !== "off") {
      this.notice(`herdr connected · ${this.herdr.note}`, "ok");
      await this.refreshHerdr();
    }
  }

  private kickHerdr(ms = 250) {
    if (this.herdrKick) return;
    this.herdrKick = setTimeout(() => {
      this.herdrKick = null;
      void this.refreshHerdr();
    }, ms);
  }

  async refreshHerdr() {
    if (this.herdrBusy || this.herdr.mode === "off") return;
    this.herdrBusy = true;
    try {
      const snap = await this.herdr.snapshot();
      this.herdrFails = 0;
      this.hsnap = snap;
      this.setProjects(this.herdrProjects(snap));
      await this.syncAgents(snap);
      this.syncPaneSessions(snap);
      this.resubscribe(snap);
    } catch (e) {
      if (++this.herdrFails >= 3) {
        console.error("[herdr] lost:", (e as Error).message);
        this.herdr.close();
        this.herdr.mode = "off";
        this.herdr.note = `lost · ${(e as Error).message}`.slice(0, 120);
        this.hsnap = null;
        for (const [id] of this.agents) this.emit({ type: "agent.remove", agentId: id });
        this.agents.clear();
        this.unwatchAll();
        this.setProjects(this.fallbackProjects());
        this.notice("herdr not reachable · showing fallback projects", "error");
      }
    } finally {
      this.herdrBusy = false;
    }
  }

  private resubscribe(snap: HSnapshot) {
    const ids = snap.agents.map((a) => a.pane_id).sort().join(",");
    if (ids === this.subscribedPanes) return;
    this.subscribedPanes = ids;
    this.herdr.subscribe(
      snap.agents.map((a) => a.pane_id),
      () => this.kickHerdr(),
      () => {
        if (this.subscribedPanes === ids) this.subscribedPanes = "";
      },
    );
  }

  private override(dir: string, repo: string): ProjectConfig | undefined {
    return this.config.projects.find((p) => (p.path ? projectPath(this.config, p) === dir : p.repo === repo));
  }

  private herdrProjects(snap: HSnapshot): Project[] {
    return deriveProjects(snap).map((d) => {
      const o = this.override(d.dir, d.repo);
      return { ...d, services: o?.services ?? ["github"], dev: o?.dev, test: o?.test };
    });
  }

  private fallbackProjects(): Project[] {
    return this.config.fallbackProjects.flatMap((p) => {
      let dir = projectPath(this.config, p);
      if (!existsSync(dir)) return [];
      dir = realpathSync(dir);
      const o = this.override(dir, p.repo);
      return [{ repo: p.repo, dir, workspaces: [], services: p.services ?? o?.services ?? ["github"], dev: p.dev ?? o?.dev, test: p.test ?? o?.test }];
    });
  }

  private setProjects(next: Project[]) {
    const now = Date.now();
    const prev = this.projects;
    const gone = prev.filter((p) => !next.some((n) => n.dir === p.dir));
    const added = next.filter((n) => !prev.some((p) => p.dir === n.dir));
    this.recent = [
      ...gone.filter((p) => p.workspaces.length).map((p) => ({ repo: p.repo, path: p.dir, label: p.label, lastSeen: now })),
      ...this.recent.filter((r) => !next.some((n) => n.dir === r.path) && !gone.some((g) => g.dir === r.path) && now - r.lastSeen < this.config.recentHours * H),
    ].slice(0, 8);
    this.projects = next;
    for (const p of gone) this.unwatchRepo(p.dir);
    for (const p of added) {
      this.watchRepo(p);
      void this.scanGit(p).then(() => this.scanCi([p]));
    }
    const sig = (ps: Project[]) => JSON.stringify(ps.map((p) => [p.repo, p.dir, p.label, p.workspaces, p.agentStatus, p.services]));
    if (sig(prev) !== sig(next) || gone.length) this.emit({ type: "projects.set", projects: this.projectInfos(), recent: this.recent });
  }

  private repoOf(cwd: string | null | undefined): string | undefined {
    if (!cwd) return undefined;
    return this.projects.find((p) => cwd === p.dir || cwd.startsWith(p.dir + "/"))?.repo;
  }

  private wsLabel(id: string) {
    return this.hsnap?.workspaces.find((w) => w.workspace_id === id)?.label ?? id;
  }

  private async syncAgents(snap: HSnapshot) {
    const now = Date.now();
    const live = new Set<string>();
    for (const a of snap.agents) {
      const id = `h-${a.pane_id}`;
      live.add(id);
      const prev = this.agents.get(id);
      const seq = a.state_change_seq ?? 0;
      const state = STATE[a.agent_status] ?? "idle";
      const repo = this.repoOf(a.foreground_cwd ?? a.cwd) ?? this.repoOf(a.cwd) ?? basename(a.foreground_cwd ?? a.cwd ?? "") ?? "unknown";
      const firstSeen = prev?.firstSeen ?? now;
      const changed = !prev || prev.seq !== seq || prev.agent.state !== state;
      let prompt = prev?.agent.prompt;
      if (state !== "waiting") prompt = undefined;
      else if (changed || !prompt) prompt = await this.readPrompt(a, seq);
      const task = cleanTitle(a.terminal_title_stripped ?? a.terminal_title ?? "", a, repo);
      const agent: AgentSession = {
        id,
        repo,
        agent: a.agent ?? "agent",
        branch: this.git.get(repo)?.payload.branch ?? "",
        cwd: a.foreground_cwd ?? a.cwd ?? "",
        task,
        state,
        startedAt: firstSeen,
        endedAt: state === "done" || state === "idle" ? (changed ? (prev ? now : firstSeen) : prev?.agent.endedAt) : undefined,
        sessionId: `pane:${a.pane_id}`,
        prompt,
        managed: true,
        note: `herdr · ${this.wsLabel(a.workspace_id)} · ${a.pane_id}${a.agent_status === "unknown" ? " · status unknown" : ""}`,
      };
      if (!prev || JSON.stringify(prev.agent) !== JSON.stringify(agent)) {
        this.agents.set(id, { agent, seq, firstSeen });
        this.emit({ type: "agent.upsert", agent });
        if (prev && prev.agent.state !== "waiting" && state === "waiting") console.log(`[herdr] ${a.pane_id} ${a.agent} blocked · ${prompt?.title ?? ""}`);
      }
    }
    for (const [id] of this.agents) {
      if (live.has(id)) continue;
      this.agents.delete(id);
      this.emit({ type: "agent.remove", agentId: id });
    }
  }

  /** What a blocked agent is asking: the question line + the last lines of its screen. */
  private async readPrompt(a: HAgent, seq: number): Promise<AgentSession["prompt"]> {
    let lines: string[] = [];
    try {
      lines = lastLines(await this.herdr.read(a.pane_id, 40, "visible"), 8);
    } catch {
      /* show a generic prompt */
    }
    const q = questionLine(lines);
    return {
      id: `${a.pane_id}#${seq}`,
      kind: /trust/i.test(lines.join("\n")) ? "workspace-trust" : "confirm",
      title: q.length > 72 ? `${q.slice(0, 71)}…` : q,
      detail: lines.join("\n") || `${a.agent ?? "agent"} is waiting on a dialog in Herdr`,
    };
  }

  private syncPaneSessions(snap: HSnapshot) {
    const live = new Set<string>();
    for (const p of snap.panes) {
      const id = `pane:${p.pane_id}`;
      live.add(id);
      const repo = this.repoOf(p.foreground_cwd ?? p.cwd);
      const title = `${this.wsLabel(p.workspace_id)} · ${p.agent ?? (paneTitle(p) || p.pane_id)}`;
      const meta: SessionMeta = { id, title, cwd: p.foreground_cwd ?? p.cwd ?? "", branch: repo ? (this.git.get(repo)?.payload.branch ?? "") : "", managed: true };
      const prev = this.paneSessions.get(id);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(meta)) {
        this.paneSessions.set(id, meta);
        this.emit({ type: "session.upsert", session: meta, lines: this.paneLines.get(id) });
      }
    }
    for (const id of [...this.paneSessions.keys()]) {
      if (live.has(id)) continue;
      this.paneSessions.delete(id);
      this.paneLines.delete(id);
      this.unwatch(id);
    }
  }

  private isAgentPane(paneId: string) {
    return !!this.hsnap?.agents.some((a) => a.pane_id === paneId);
  }
  private agentOn(paneId: string) {
    return this.hsnap?.agents.find((a) => a.pane_id === paneId);
  }

  /* --- pane output (read on demand while the UI shows it) ---------------------------- */

  private watch(sessionId: string) {
    const pane = paneOf(sessionId);
    if (!pane || this.herdr.mode === "off" || !this.paneSessions.has(sessionId)) return;
    if (this.watched.has(sessionId)) return void this.readPane(sessionId, true);
    while (this.watched.size >= MAX_WATCHED) this.unwatch(this.watched.keys().next().value as string);
    const entry = { timer: setInterval(() => void this.readPane(sessionId), 1000), last: "" };
    this.watched.set(sessionId, entry);
    void this.readPane(sessionId, true);
  }

  private unwatch(sessionId: string) {
    const w = this.watched.get(sessionId);
    if (!w) return;
    clearInterval(w.timer);
    this.watched.delete(sessionId);
  }

  private unwatchAll() {
    for (const id of [...this.watched.keys()]) this.unwatch(id);
  }

  private async readPane(sessionId: string, force = false) {
    const pane = paneOf(sessionId);
    const w = this.watched.get(sessionId);
    if (!pane || !w) return;
    let text: string;
    try {
      text = await this.herdr.read(pane, 200);
    } catch (e) {
      if (force) this.termNote(sessionId, `✕ couldn't read pane ${pane} · ${(e as Error).message}`);
      return;
    }
    if (!force && text === w.last) return;
    w.last = text;
    const rows = text.replace(/\s+$/, "").split("\n").slice(-200);
    const now = Date.now();
    const lines: TermLine[] = rows.map((t, i) => ({ id: `${pane}:${rows.length - i}:${t.length}`, at: now, kind: kindOf(t), text: t }));
    this.paneLines.set(sessionId, lines);
    const meta = this.paneSessions.get(sessionId);
    if (meta) this.emit({ type: "session.upsert", session: meta, lines });
  }

  /* --- git / CI --------------------------------------------------------------------- */

  private watchRepo(p: Project) {
    const kick = () => {
      clearTimeout(this.gitTimers.get(p.dir));
      this.gitTimers.set(
        p.dir,
        setTimeout(() => {
          const cur = this.projects.find((x) => x.dir === p.dir);
          if (cur) void this.scanGit(cur);
        }, 600),
      );
    };
    const list: FSWatcher[] = [];
    const add = (dir: string, recursive: boolean, filter?: (f: string) => boolean) => {
      try {
        const w = watch(dir, { persistent: false, recursive }, (_ev, file) => {
          if (!filter || (file && filter(String(file)))) kick();
        });
        w.on("error", () => w.close());
        list.push(w);
      } catch {
        /* polling still covers it */
      }
    };
    add(`${p.dir}/.git`, false, (f) => ["HEAD", "index", "ORIG_HEAD", "FETCH_HEAD", "packed-refs"].includes(f));
    add(`${p.dir}/.git/refs/heads`, true);
    this.watchers.set(p.dir, list);
  }

  private unwatchRepo(dir: string) {
    for (const w of this.watchers.get(dir) ?? []) w.close();
    this.watchers.delete(dir);
    clearTimeout(this.gitTimers.get(dir));
  }

  private async refreshGh() {
    this.gh = await ghState();
  }

  async scanAllGit() {
    await Promise.all(this.projects.map((p) => this.scanGit(p)));
  }

  private async scanGit(p: Project) {
    const g = await readGit(p.dir, this.config.staleBranchDays);
    if (!g) return;
    const prev = this.git.get(p.repo);
    this.git.set(p.repo, g);
    if (!prev || JSON.stringify(prev.payload) !== JSON.stringify(g.payload)) {
      this.emit({ type: "service.upsert", service: "github", repo: p.repo, payload: this.gitPayload(p.repo, g) });
    }
  }

  async scanCi(list: Project[] = this.projects) {
    if (!this.gh.authed) return;
    for (const p of list) {
      const slug = this.git.get(p.repo)?.github;
      if (!slug) continue;
      const [runInfo, prs] = await Promise.all([latestRun(p.repo, slug), openPrCount(slug)]);
      if (runInfo) {
        const prev = this.ci.get(p.repo);
        this.ci.set(p.repo, runInfo);
        if (!prev || JSON.stringify(prev) !== JSON.stringify(runInfo)) this.emit({ type: "ci.upsert", run: runInfo });
      }
      if (prs !== null && prs !== this.prs.get(p.repo)) {
        this.prs.set(p.repo, prs);
        const g = this.git.get(p.repo);
        if (g) this.emit({ type: "service.upsert", service: "github", repo: p.repo, payload: this.gitPayload(p.repo, g) });
      }
    }
  }

  /* --- processes / ports ------------------------------------------------------------- */

  /** Herdr pane shells (pid → pane), so a listener can be traced to the pane that started it. */
  private async refreshPaneShells() {
    if (this.herdr.mode === "off" || !this.hsnap || Date.now() - this.paneShellsAt < 15_000) return;
    this.paneShellsAt = Date.now();
    const map = new Map<number, string>();
    const infos = await Promise.all(this.hsnap.panes.map((p) => this.herdr.processInfo(p.pane_id)));
    for (const info of infos) {
      if (!info) continue;
      if (info.shell_pid) map.set(info.shell_pid, info.pane_id);
      for (const fp of info.foreground_processes ?? []) map.set(fp.pid, info.pane_id);
    }
    this.paneShells = map;
  }

  private sessionOf(procs: Map<number, Proc>, pid: number): string | undefined {
    let cur = procs.get(pid);
    for (let i = 0; cur && i < 64; i++) {
      const s = this.sessions.sessionForPid(cur.pid);
      if (s) return s;
      const pane = this.paneShells.get(cur.pid);
      if (pane) return `pane:${pane}`;
      if (cur.ppid <= 1) return undefined;
      cur = procs.get(cur.ppid);
    }
    return undefined;
  }

  async scanProcs() {
    if (this.scanning) return;
    this.scanning = true;
    try {
      const herdrOn = this.herdr.mode !== "off";
      const [procs, listening] = await Promise.all([listProcs(), listListeners(), this.refreshPaneShells()]);
      const now = Date.now();
      const managed = this.sessions.pids();
      const mine = (p?: Proc) => !!p && (this.myUid < 0 || p.uid === this.myUid);

      // Process-scanned agents only without Herdr (Herdr knows its agents better).
      const agentProcs = herdrOn
        ? []
        : [...procs.values()].filter((p) => {
            if (p.pid === process.pid || !mine(p)) return false;
            const kind = agentKindOf(p.command);
            if (!kind || descendsFrom(procs, p.pid, managed)) return false;
            const parent = procs.get(p.ppid);
            return !(parent && agentKindOf(parent.command) === kind);
          });
      const listenPids = listening.map((l) => l.pid).filter((pid) => pid !== process.pid);
      const cwd = await cwdsOf([...new Set([...agentProcs.map((p) => p.pid), ...listenPids])]);

      /* servers */
      const servers: DevServer[] = [];
      let hidden = 0;
      const ignored = new Set(this.config.ignorePorts);
      for (const l of listening) {
        if (l.pid === process.pid || l.ports.every((port) => ignored.has(port))) continue;
        const p = procs.get(l.pid);
        const command = p?.command ?? l.name;
        const dir = cwd.get(l.pid);
        const repo = this.repoOf(dir);
        const devLike = isDevLike(command) || isDevLike(l.name);
        if (!repo && !devLike) {
          hidden++;
          continue;
        }
        const sessionId = p ? this.sessionOf(procs, l.pid) : undefined;
        const up = p?.elapsed ?? 0;
        let note: string | undefined;
        if (!sessionId && devLike) {
          const g = repo ? this.git.get(repo) : undefined;
          if (p && orphaned(procs, p)) note = `orphan · parent gone · up ${fmtUp(up)}`;
          else if (repo && up > 8 * 3600 && g && now - g.activityAt > 8 * H) note = `up ${fmtUp(up)} · ${repo} idle ${ago(now - g.activityAt)}`;
          else if (!repo && up > 2 * 3600) note = `${herdrOn ? "no open Herdr workspace" : "not a watched project"} · up ${fmtUp(up)}`;
        }
        for (const port of l.ports.filter((x) => !ignored.has(x)).sort((a, b) => a - b)) {
          servers.push({
            id: `p-${port}`,
            port,
            repo,
            pid: l.pid,
            command: shortCommand(command),
            state: note ? "stale" : "running",
            sessionId,
            note: note ?? (dir && !repo ? dir.replace(/^\/Users\/[^/]+/, "~") : undefined),
            startedAt: now - up * 1000,
          });
        }
      }
      for (const p of this.projects) {
        if (!p.dev) continue;
        if (servers.some((s) => s.repo === p.repo && s.port === p.dev!.port)) continue;
        servers.push({ id: `dev-${p.repo}`, port: p.dev.port, repo: p.repo, command: p.dev.command, state: "stopped" });
      }
      servers.sort((a, b) => Number(!a.repo) - Number(!b.repo) || a.port - b.port);
      this.hiddenListeners = hidden;
      // startedAt jitters by a second between scans (ps etime): compare without it.
      const sig = (xs: DevServer[]) => JSON.stringify(xs.map((x) => ({ ...x, startedAt: undefined })));
      if (sig(servers) !== sig(this.servers)) {
        this.servers = servers;
        this.emit({ type: "servers.set", servers });
      }
      this.syncExternalAgents(agentProcs, cwd, now);
    } catch (e) {
      console.error("[procs]", (e as Error).message);
    } finally {
      this.scanning = false;
    }
  }

  /** Fallback (no Herdr): agents found by process name. Output isn't visible. */
  private syncExternalAgents(agentProcs: Proc[], cwd: Map<number, string>, now: number) {
    const seen = new Set<number>();
    for (const p of agentProcs) {
      seen.add(p.pid);
      const kind = agentKindOf(p.command)!;
      const dir = cwd.get(p.pid) ?? "";
      const repo = this.repoOf(dir) ?? (dir.split("/").pop() || "unknown");
      const existing = this.external.get(p.pid);
      const branch = this.git.get(repo)?.payload.branch ?? "";
      if (existing && !existing.goneAt && existing.agent.branch === branch) continue;
      const sessionId = `t-ext-${p.pid}`;
      const agent: AgentSession = {
        id: `ext-${p.pid}`,
        repo,
        agent: kind,
        branch,
        cwd: dir,
        task: "started outside Umbra",
        state: "running",
        startedAt: now - p.elapsed * 1000,
        sessionId,
        managed: false,
        pid: p.pid,
        note: "herdr off · output not visible",
      };
      const session = { id: sessionId, title: `${repo} · ${kind}`, cwd: dir, branch, managed: false };
      const lines: TermLine[] = existing?.lines ?? [
        { id: `${sessionId}-1`, at: now, kind: "sys", text: `${kind} · pid ${p.pid} · found running (up ${fmtUp(p.elapsed)})` },
        { id: `${sessionId}-2`, at: now, kind: "dim", text: shortCommand(p.command) },
        { id: `${sessionId}-3`, at: now, kind: "dim", text: "Herdr isn't running, so this agent's output and prompts aren't visible here" },
      ];
      this.external.set(p.pid, { agent, session, lines });
      this.emit({ type: "session.upsert", session, lines });
      this.emit({ type: "agent.upsert", agent });
    }
    for (const [pid, e] of this.external) {
      if (seen.has(pid)) continue;
      if (!e.goneAt) {
        e.goneAt = now;
        e.agent = { ...e.agent, state: "stopped", endedAt: now };
        this.emit({ type: "agent.upsert", agent: e.agent });
      } else if (now - e.goneAt > 10 * 60_000 || this.herdr.mode !== "off") {
        this.external.delete(pid);
        this.emit({ type: "agent.remove", agentId: e.agent.id });
      }
    }
  }

  /* --- requests --------------------------------------------------------------------- */

  async handle(req: WireRequest, origin: string): Promise<void> {
    if (req.type === "term.watch") {
      // UI plumbing: not an action, not audited.
      if (req.on) this.watch(req.sessionId);
      else this.unwatch(req.sessionId);
      return;
    }
    const risk = riskOf(req);
    const base = { action: req.type, origin, ...summary(req) };
    if (risk.risky) {
      const ok = this.approvals.consume(req.approvalId, req);
      if (!ok.ok) {
        audit({ ...base, result: "refused", reason: risk.reason, why: ok.why });
        this.notice(`refused · ${risk.reason} · ${ok.why}`, "denied");
        if (req.type === "term.exec") this.termNote(req.sessionId, `✕ refused by helper · ${risk.reason} · needs approval`);
        return;
      }
    }
    const approvalId = risk.risky ? req.approvalId : undefined;
    const done = (result: "ok" | "error" | "refused", extra: Record<string, unknown> = {}) => audit({ ...base, approvalId, result, ...extra });
    const herdrFail = (e: unknown, what: string) => {
      const msg = e instanceof HerdrError ? `${e.code}: ${e.message}` : (e as Error).message;
      this.notice(`${what} failed · ${msg}`, "error");
      return done("error", { why: msg });
    };

    switch (req.type) {
      case "term.exec": {
        const pane = paneOf(req.sessionId);
        if (pane) {
          if (this.herdr.mode === "off") return done("error", { why: "herdr off" });
          const cmd = req.command.trim();
          const agent = this.agentOn(pane);
          try {
            if (cmd === "^C") {
              if (agent) await this.herdr.agentKeys(pane, ["ctrl+c"]);
              else await this.herdr.paneKeys(pane, ["ctrl+c"]);
            } else if (agent) {
              if (agent.agent_status === "blocked") {
                this.termNote(req.sessionId, "✕ agent is waiting on a dialog · answer it with Approve / Deny first");
                return done("refused", { why: "agent blocked" });
              }
              await this.herdr.prompt(pane, cmd);
            } else {
              await this.herdr.paneInput(pane, cmd);
            }
          } catch (e) {
            this.termNote(req.sessionId, `✕ herdr refused · ${(e as Error).message}`);
            return herdrFail(e, "send");
          }
          setTimeout(() => void this.readPane(req.sessionId), 300);
          this.kickHerdr(800);
          return done("ok", { via: agent ? (cmd === "^C" ? "agent.send_keys" : "agent.prompt") : cmd === "^C" ? "pane.send_keys" : "pane.send_input" });
        }
        if (!this.sessions.has(req.sessionId)) {
          this.termNote(req.sessionId, "✕ read-only · this terminal isn't one Umbra can type into");
          return done("refused", { why: "not managed" });
        }
        if (req.command.trim() === "clear") {
          this.sessions.clear(req.sessionId);
          return done("ok");
        }
        const r = this.sessions.exec(req.sessionId, req.command);
        return done(r.ok ? "ok" : "error", r.why ? { why: r.why } : {});
      }
      case "agent.respond": {
        if (req.agentId.startsWith("h-")) {
          const pane = req.agentId.slice(2);
          const cur = this.agents.get(req.agentId)?.agent;
          const live = this.agentOn(pane);
          if (!cur?.prompt || !live || live.agent_status !== "blocked") {
            this.notice("answer not sent · the agent isn't waiting anymore", "error");
            return done("error", { why: "not blocked" });
          }
          if (cur.prompt.id !== req.promptId) {
            this.notice("answer not sent · the dialog changed · look again", "error");
            this.kickHerdr(0);
            return done("error", { why: "prompt changed" });
          }
          const keys = approvalKeys(cur.prompt.detail, req.answer);
          try {
            await this.herdr.agentKeys(pane, keys);
          } catch (e) {
            return herdrFail(e, "answer");
          }
          this.notice(`${cur.agent} · ${req.answer === "approve" ? "approved" : "denied"} · sent ${keys.join(" ")}`, "ok");
          this.kickHerdr(500);
          return done("ok", { answer: req.answer, keys, question: cur.prompt.title, pane });
        }
        const r = this.sessions.respond(req.agentId, req.promptId, req.answer);
        if (!r.ok) this.notice(`answer not sent · ${r.why}`, "error");
        return done(r.ok ? "ok" : "error", { answer: req.answer, ...(r.why ? { why: r.why } : {}) });
      }
      case "agent.dispatch": {
        const p = this.project(req.repo);
        if (!p) {
          this.notice(`unknown project ${req.repo}`, "error");
          return done("error", { why: "unknown project" });
        }
        if (this.herdr.mode !== "off") {
          const ready = (this.hsnap?.agents ?? []).filter((a) => a.agent === req.agent && (a.agent_status === "idle" || a.agent_status === "done") && this.repoOf(a.foreground_cwd ?? a.cwd) === p.repo);
          const target = ready[0];
          if (!target || !req.task.trim()) {
            this.notice(!req.task.trim() ? "write a task first" : `no idle ${req.agent} in ${p.label ?? p.repo} · start one in Herdr`, "error");
            return done("error", { why: !req.task.trim() ? "empty task" : "no idle agent" });
          }
          try {
            await this.herdr.prompt(target.pane_id, req.task.trim());
          } catch (e) {
            return herdrFail(e, "dispatch");
          }
          this.notice(`sent to ${req.agent} · ${this.wsLabel(target.workspace_id)} · ${target.pane_id}`, "ok");
          this.kickHerdr(800);
          return done("ok", { pane: target.pane_id });
        }
        const cmd = this.config.agents[req.agent];
        if (!cmd) {
          this.notice(`agent "${req.agent}" isn't configured in umbra.helper.json`, "error");
          return done("error", { why: "agent not configured" });
        }
        const args = [...(cmd.args ?? []), ...(req.task.trim() ? [req.task.trim()] : [])];
        const branch = this.git.get(p.repo)?.payload.branch ?? "";
        this.sessions.start({ repo: p.repo, cwd: p.dir, branch, kind: "agent", title: `${p.repo} · ${req.agent}`, file: cmd.command, args, agent: { kind: req.agent, task: req.task } });
        return done("ok");
      }
      case "pane.focus": {
        const pane = paneOf(req.sessionId);
        if (!pane || this.herdr.mode === "off") return done("error", { why: "not a herdr pane" });
        try {
          await this.herdr.focus(pane, this.isAgentPane(pane), this.hsnap?.panes.find((p) => p.pane_id === pane)?.tab_id);
        } catch (e) {
          return herdrFail(e, "focus");
        }
        this.notice(`focused ${pane} in Herdr`, "ok");
        return done("ok", { pane });
      }
      case "process.kill": {
        const known = this.servers.find((s) => s.pid === req.pid) ?? [...this.external.values()].find((e) => e.agent.pid === req.pid);
        if (!known) {
          this.notice(`kill ${req.pid} refused · not a dev process the helper is showing`, "denied");
          return done("refused", { why: "unknown pid" });
        }
        try {
          process.kill(req.pid, "SIGTERM");
        } catch (e) {
          this.notice(`kill ${req.pid} failed · ${(e as Error).message}`, "error");
          return done("error", { why: (e as Error).message });
        }
        done("ok", { signal: "SIGTERM" });
        setTimeout(() => {
          let alive = true;
          try {
            process.kill(req.pid, 0);
          } catch {
            alive = false;
          }
          const port = this.servers.find((s) => s.pid === req.pid)?.port;
          this.notice(alive ? `pid ${req.pid} still running after SIGTERM` : `pid ${req.pid} stopped${port ? ` · :${port} free` : ""}`, alive ? "error" : "ok");
          void this.scanProcs();
        }, 1500);
        return;
      }
      case "server.start": {
        const p = this.projects.find((x) => `dev-${x.repo}` === req.serverId);
        if (!p?.dev) return done("error", { why: "no dev command configured" });
        this.sessions.start({ repo: p.repo, cwd: p.dir, branch: this.git.get(p.repo)?.payload.branch ?? "", kind: "task", title: `${p.repo} · ${p.dev.command}`, file: "/bin/sh", args: ["-c", p.dev.command] });
        setTimeout(() => void this.scanProcs(), 3000);
        return done("ok");
      }
      case "tests.run": {
        const p = this.project(req.repo);
        if (!p) return done("error", { why: "unknown project" });
        const cmd = p.test ?? "pnpm test";
        this.sessions.start({
          repo: p.repo,
          cwd: p.dir,
          branch: this.git.get(p.repo)?.payload.branch ?? "",
          kind: "task",
          title: `${p.repo} · ${cmd}`,
          file: "/bin/sh",
          args: ["-c", cmd],
          onExit: (code) => this.notice(`${p.repo} tests · ${code === 0 ? "passed" : `failed (exit ${code})`}`, code === 0 ? "ok" : "error"),
        });
        return done("ok");
      }
      case "session.start": {
        const p = this.project(req.repo);
        if (!p) return done("error", { why: "unknown project" });
        const id = req.sessionId && /^[\w-]{1,48}$/.test(req.sessionId) ? req.sessionId : undefined;
        const tty = this.ptyMode.mode !== "pipe";
        this.sessions.start({
          id,
          repo: p.repo,
          cwd: p.dir,
          branch: this.git.get(p.repo)?.payload.branch ?? "",
          kind: "shell",
          title: `${p.repo} · shell`,
          file: "/bin/bash",
          args: tty ? ["--noprofile", "--norc", "-i"] : ["--noprofile", "--norc"],
        });
        return done("ok");
      }
      case "sessions.resume":
        this.notice(this.herdr.mode !== "off" ? "agents live in Herdr · nothing to resume" : "helper sessions persist · nothing to resume", "info");
        return done("ok");
      default:
        this.notice("unknown request", "error");
        return done("error", { why: "unknown request" });
    }
  }

  private project(repo: string) {
    return this.projects.find((p) => p.repo === repo);
  }

  private termNote(sessionId: string, text: string) {
    this.emit({ type: "term.append", sessionId, lines: [{ id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), kind: "err", text }] });
  }
}

/**
 * Reparented to launchd/init (or a root-owned supervisor) = whatever started it is gone.
 * A server still under a shell, pnpm, or a terminal isn't an orphan.
 */
function orphaned(procs: Map<number, Proc>, p: Proc): boolean {
  if (p.ppid <= 1) return true;
  const parent = procs.get(p.ppid);
  return !parent || (parent.uid === 0 && p.uid !== 0);
}

/** Pane label: its title, with prompt-style titles ("me@host:~/path") shown as "shell". */
function paneTitle(p: HPane) {
  const t = (p.terminal_title_stripped ?? p.terminal_title ?? "").trim();
  return /^[\w.-]+@[\w.-]+:[~/]/.test(t) ? "shell" : t;
}

/** Herdr titles are often just the agent's name or the folder; keep only real task titles. */
function cleanTitle(t: string, a: HAgent, repo: string): string {
  const s = t.replace(/\s*\|\s*[\w.-]+\s*$/, "").trim();
  const generic = [a.agent, a.display_agent, repo, `π - ${repo}`, "Cursor Agent", "Claude Code", "codex", ""].map((x) => (x ?? "").toLowerCase());
  return generic.includes(s.toLowerCase()) ? "" : s;
}

function summary(req: WireRequest): Record<string, unknown> {
  switch (req.type) {
    case "term.exec":
      return { sessionId: req.sessionId, command: req.command };
    case "process.kill":
      return { pid: req.pid };
    case "agent.dispatch":
      return { repo: req.repo, agent: req.agent, task: req.task };
    case "agent.respond":
      return { agentId: req.agentId, promptId: req.promptId };
    case "server.start":
      return { serverId: req.serverId };
    case "pane.focus":
      return { sessionId: req.sessionId };
    case "tests.run":
    case "session.start":
      return { repo: req.repo };
    default:
      return {};
  }
}
