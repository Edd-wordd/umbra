/**
 * SAMPLE dev workspace: every repo, pid, test name and Sentry id below is
 * made up (shaped after Edward's real terminal setup). Nothing here spawns a
 * process, opens a socket or touches the filesystem.
 *
 * `createMockDevBridge()` implements the same DevBridge interface the
 * Mac-helper terminal bridge will (Phase 2): it owns the model, answers
 * requests with events after a short, realistic delay, and refuses risky
 * requests that are not marked approved.
 */
import { shortCwd } from "../dev/format";
import { classifyCommand } from "../dev/risk";
import { createServicePayloads, type MockVariant } from "./services";

export type { MockVariant };
import type {
  AgentKind,
  AgentSession,
  CiRun,
  DevBridge,
  DevEvent,
  DevRequest,
  DevServer,
  DevSnapshot,
  RepoId,
  TermLine,
  TermLineKind,
  TermSession,
} from "../dev/types";

const HOME = "/Users/eddwordd";
const PROJECTS = `${HOME}/Documents/codes/projects`;
const MIN = 60_000;

let seq = 0;
const uid = (p: string) => `${p}-${(++seq).toString(36)}`;

type Spec = [TermLineKind, string];
const lines = (at: number, specs: readonly Spec[]): TermLine[] =>
  specs.map(([kind, text], i) => ({ id: uid("l"), at: at + i * 40, kind, text }));

const prompt = (s: { cwd: string; branch: string }, cmd: string): Spec => ["cmd", `${shortCwd(s.cwd)} ${s.branch} ❯ ${cmd}`];

/* ------------------------------------------------------------------------- */
/* Snapshot                                                                   */
/* ------------------------------------------------------------------------- */

export const MOCK_REPOS: readonly RepoId[] = ["umbra", "parallax", "deadbridge-site", "google"];
export const MOCK_AGENT_KINDS: readonly AgentKind[] = ["cursor", "codex", "pi"];

export const STALE_PID = 28409;

export function createDevSnapshot(now: number, variant: MockVariant = "default"): DevSnapshot {
  const snap = createLoudSnapshot(now);
  return variant === "quiet" ? quietDown(snap, now) : snap;
}

/**
 * A good day (`?mock=quiet`): one agent quietly working, the dev server up,
 * CI green, nothing held, nothing stale, nothing unpushed.
 */
function quietDown(s: DevSnapshot, now: number): DevSnapshot {
  const google = s.agents.find((a) => a.repo === "google")!;
  return {
    ...s,
    agents: [google],
    servers: s.servers.filter((x) => x.state !== "stale"),
    ci: [
      { id: "ci-deadbridge-97", repo: "deadbridge-site", branch: "main", number: 97, status: "passed", summary: "3/3 jobs", failing: [], at: now - 41 * MIN },
      { id: "ci-parallax-319", repo: "parallax", branch: "main", number: 319, status: "passed", summary: "45 passed", failing: [], at: now - 3 * 60 * MIN },
    ],
    services: createServicePayloads(now, "quiet"),
    handoff: {
      at: now - 14 * 60 * MIN,
      items: [
        { repo: "google", branch: "master", summary: "pi porting gmail label sync, step 2/3", tone: "active" },
        { repo: "deadbridge-site", branch: "main", summary: "lint fix merged, deployed", tone: "mid" },
      ],
    },
  };
}

function createLoudSnapshot(now: number): DevSnapshot {
  const cwd = (r: RepoId) => `${PROJECTS}/${r}`;

  const agents: AgentSession[] = [
    {
      id: "a-umbra",
      repo: "umbra",
      agent: "cursor",
      branch: "main",
      cwd: cwd("umbra"),
      task: "wire dev focus mock",
      state: "waiting",
      startedAt: now - 2 * MIN - 14_000,
      sessionId: "t-umbra-agent",
      prompt: {
        id: "p-trust",
        kind: "workspace-trust",
        title: "Workspace trust",
        detail: "Cursor Agent can execute code and access files in ~/Documents/codes/projects/umbra",
      },
    },
    {
      id: "a-parallax",
      repo: "parallax",
      agent: "cursor",
      branch: "fix/target-sort",
      cwd: cwd("parallax"),
      task: "sort tonight's targets by next transit",
      state: "failed",
      startedAt: now - 18 * MIN,
      endedAt: now - 3 * MIN,
      sessionId: "t-parallax-agent",
      failure: {
        summary: "1 failing test",
        tests: ["targets.sort.spec.ts › orders targets by next transit"],
        ciRunId: "ci-parallax-318",
        sentryId: "SAMPLE-7Q",
      },
    },
    {
      id: "a-deadbridge",
      repo: "deadbridge-site",
      agent: "codex",
      branch: "fix/start-form-lint",
      cwd: cwd("deadbridge-site"),
      task: "fix lint in start-a-project form",
      state: "done",
      startedAt: now - 31 * MIN,
      endedAt: now - 22 * MIN,
      sessionId: "t-deadbridge-agent",
      diff: { files: 3, additions: 42, deletions: 11 },
    },
    {
      id: "a-google",
      repo: "google",
      agent: "pi",
      branch: "master",
      cwd: cwd("google"),
      task: "port gmail label sync to new client",
      state: "running",
      startedAt: now - 6 * MIN - 40_000,
      sessionId: "t-google-agent",
    },
  ];

  const S = (id: string, title: string, repo: RepoId, branch: string, specs: readonly Spec[], at: number): TermSession => ({
    id,
    title,
    cwd: cwd(repo),
    branch,
    lines: lines(at, specs),
  });
  const u = { cwd: cwd("umbra"), branch: "main" };
  const p = { cwd: cwd("parallax"), branch: "fix/target-sort" };
  const d = { cwd: cwd("deadbridge-site"), branch: "fix/start-form-lint" };
  const g = { cwd: cwd("google"), branch: "master" };

  const sessions: Record<string, TermSession> = {};
  const add = (s: TermSession) => (sessions[s.id] = s);

  add(
    S("t-umbra-agent", "umbra · cursor", "umbra", "main", [
      prompt(u, "agent"),
      ["dim", "Cursor Agent v2026.10.01-14929f9"],
      ["out", ""],
      ["warn", "⚠ Workspace Trust Required"],
      ["out", "  Cursor Agent can execute code and access files in this directory."],
      ["out", "  Do you trust the contents of this directory?"],
      ["out", `  ${cwd("umbra")}`],
      ["out", ""],
      ["dim", "  [a] Trust this workspace    [q] Quit"],
      ["warn", "⌛ waiting for you · approve or deny under needs you"],
    ], now - 2 * MIN),
  );

  add(
    S("t-parallax-agent", "parallax · cursor", "parallax", "fix/target-sort", [
      ["sys", "agent · editing src/lib/targets.ts (sortByTransit)"],
      ["dim", "  ~ src/lib/targets.ts  +18 −6"],
      prompt(p, "pnpm test"),
      ["dim", "> parallax@0.4.2 test"],
      ["dim", "> vitest run"],
      ["out", ""],
      ["ok", " ✓ src/lib/ephemeris.spec.ts (14)"],
      ["ok", " ✓ src/lib/coords.spec.ts (22)"],
      ["err", " ✕ src/lib/targets.sort.spec.ts (9) · 1 failed"],
      ["err", "   ✕ orders targets by next transit"],
      ["out", "     AssertionError: expected [ 'M42', 'M31', 'M45' ]"],
      ["out", "       to deeply equal [ 'M31', 'M45', 'M42' ]"],
      ["dim", "     ❯ src/lib/targets.sort.spec.ts:41:29"],
      ["out", ""],
      ["err", " Test Files  1 failed | 2 passed (3)"],
      ["err", "      Tests  1 failed | 44 passed (45)"],
      ["sys", "agent · tests failing after sortByTransit() change; stopped for review"],
      ["warn", "agent · matches sentry SAMPLE-7Q (TypeError … reading 'transit')"],
    ], now - 4 * MIN),
  );

  add(
    S("t-deadbridge-agent", "deadbridge-site · codex", "deadbridge-site", "fix/start-form-lint", [
      prompt(d, "codex \"fix lint in start-a-project form\""),
      ["sys", "codex · reading eslint output (4 problems)"],
      ["dim", "  ~ src/components/StartProjectForm.tsx"],
      ["dim", "  ~ src/components/StartProjectForm.fields.ts"],
      ["dim", "  ~ src/lib/validate.ts"],
      prompt(d, "pnpm lint"),
      ["dim", "> eslint ."],
      ["ok", "✓ no problems"],
      ["sys", "codex · done · 3 files changed, +42 −11 · ready for review"],
    ], now - 23 * MIN),
  );

  add(
    S("t-google-agent", "google · pi", "google", "master", [
      prompt(g, "pi \"port gmail label sync to new client\""),
      ["sys", "pi · plan: 1) swap client  2) map label ids  3) keep tests green"],
      ["dim", "  ~ src/gmail/client.ts"],
      ["dim", "  ~ src/gmail/labels.ts"],
      ["out", "pi · running vitest src/gmail --watch=false"],
      ["ok", " ✓ src/gmail/labels.spec.ts (11)"],
      ["sys", "pi · step 2/3 · mapping label ids"],
    ], now - 6 * MIN),
  );

  add(
    S("t-umbra-dev", "umbra · pnpm dev", "umbra", "main", [
      prompt(u, "pnpm dev"),
      ["dim", `> umbra@0.1.0 dev ${cwd("umbra")}`],
      ["dim", "> next dev"],
      ["out", ""],
      ["warn", `⚠ Port 3000 is in use by process ${STALE_PID}, using available port 3002 instead.`],
      ["out", "▲ Next.js 16.3.8 (Turbopack)"],
      ["out", "- Local:        http://localhost:3002"],
      ["out", "- Network:      http://192.168.191.115:3002"],
      ["ok", "✓ Ready in 1092ms"],
      ["ok", "✓ Running next.config.ts took 3.0s"],
      ["out", ""],
      ["dim", "○ Compiling / ..."],
      ["out", " GET / 200 in 7.8s (next.js: 7.2s, application-code: 609ms)"],
      ["warn", "[browser] THREE.Clock: This module has been deprecated. Please use THREE.Timer instead."],
    ], now - 45 * MIN),
  );

  add(S("t-deadbridge-dev", "deadbridge-site · pnpm dev", "deadbridge-site", "main", [["dim", "process exited · 21:14"]], now - 90 * MIN));

  const servers: DevServer[] = [
    { id: "s-umbra", port: 3002, repo: "umbra", pid: 41822, command: "next dev", state: "running", sessionId: "t-umbra-dev" },
    { id: "s-stale", port: 3000, pid: STALE_PID, command: "node", state: "stale", note: "free port 3000?" },
    { id: "s-deadbridge", port: 3001, repo: "deadbridge-site", command: "next dev", state: "stopped", sessionId: "t-deadbridge-dev" },
  ];

  const ci: CiRun[] = [
    {
      id: "ci-parallax-318",
      repo: "parallax",
      branch: "fix/target-sort",
      number: 318,
      status: "failed",
      summary: "1 failed · 44 passed",
      failing: ["targets.sort.spec.ts › orders targets by next transit"],
      sentryId: "SAMPLE-7Q",
      at: now - 3 * MIN,
    },
    {
      id: "ci-deadbridge-96",
      repo: "deadbridge-site",
      branch: "fix/start-form-lint",
      number: 96,
      status: "running",
      summary: "2/3 jobs",
      failing: [],
      at: now - 2 * MIN,
    },
  ];

  return {
    agents,
    sessions,
    servers,
    ci,
    services: createServicePayloads(now),
    handoff: {
      at: now - 55 * MIN,
      items: [
        { repo: "umbra", branch: "main", summary: "Phase 0 shell done, dev server on :3002", tone: "active" },
        { repo: "parallax", branch: "fix/target-sort", summary: "1 failing test (sortByTransit)", tone: "broken" },
        { repo: "deadbridge-site", branch: "fix/start-form-lint", summary: "lint fix ready for review", tone: "mid" },
        { repo: "google", branch: "master", summary: "pi mid-refactor, no commits yet", tone: "mid" },
      ],
    },
  };
}

/* ------------------------------------------------------------------------- */
/* Fake shell                                                                 */
/* ------------------------------------------------------------------------- */

const repoOf = (s: TermSession): RepoId => s.cwd.split("/").pop() ?? "umbra";

const PARALLAX_TEST: readonly Spec[] = [
  ["dim", "> parallax@0.4.2 test"],
  ["dim", "> vitest run"],
  ["ok", " ✓ src/lib/ephemeris.spec.ts (14)"],
  ["ok", " ✓ src/lib/coords.spec.ts (22)"],
  ["err", " ✕ src/lib/targets.sort.spec.ts (9) · 1 failed"],
  ["err", "   ✕ orders targets by next transit"],
  ["err", "      Tests  1 failed | 44 passed (45)"],
];

const LS: Record<string, string> = {
  umbra: "AGENTS.md  CHECKLIST.md  DESIGN.md  README.md  next.config.ts  package.json  references  src  wireframes",
  parallax: "README.md  package.json  src  vitest.config.ts",
  "deadbridge-site": "README.md  package.json  public  src  tailwind.config.ts",
  google: "README.md  package.json  src  tsconfig.json",
};

/** Output for a non-risky command. SAMPLE text only; nothing is executed. */
function respond(session: TermSession, command: string): Spec[] {
  const repo = repoOf(session);
  const c = command.trim().replace(/\s+/g, " ");
  if (c === "help")
    return [
      ["dim", "sample shell · nothing runs on any machine"],
      ["dim", "try: git status · git diff --stat · git log --oneline -3 · pnpm test"],
      ["dim", "     pnpm lint · lsof -i :3000 · ls · pwd · clear"],
      ["dim", "risky (rm, push, --force, reset --hard, kill) asks for your yes first"],
    ];
  if (c === "pwd") return [["out", session.cwd]];
  if (c === "ls") return [["out", LS[repo] ?? "README.md  package.json  src"]];
  if (c === "git status") {
    if (repo === "deadbridge-site")
      return [
        ["out", `On branch ${session.branch}`],
        ["out", "Changes not staged for commit:"],
        ["warn", "  modified:   src/components/StartProjectForm.tsx"],
        ["warn", "  modified:   src/components/StartProjectForm.fields.ts"],
        ["warn", "  modified:   src/lib/validate.ts"],
      ];
    if (repo === "parallax")
      return [
        ["out", `On branch ${session.branch}`],
        ["warn", "  modified:   src/lib/targets.ts"],
      ];
    return [
      ["out", `On branch ${session.branch}`],
      ["out", "nothing to commit, working tree clean"],
    ];
  }
  if (c === "git diff --stat" || c === "git diff") {
    if (repo === "deadbridge-site")
      return [
        ["out", " src/components/StartProjectForm.tsx        | 31 +++++++++-------"],
        ["out", " src/components/StartProjectForm.fields.ts |  14 ++++--"],
        ["out", " src/lib/validate.ts                        |   8 +++-"],
        ["ok", " 3 files changed, 42 insertions(+), 11 deletions(-)"],
      ];
    if (repo === "parallax")
      return [
        ["out", " src/lib/targets.ts | 24 ++++++++++++------"],
        ["ok", " 1 file changed, 18 insertions(+), 6 deletions(-)"],
      ];
    return [["dim", "(no changes)"]];
  }
  if (c.startsWith("git log"))
    return repo === "umbra"
      ? [
          ["out", "3363443 Docs: Run locally section; tick completed Phase 0 items"],
          ["out", "0f28f27 Add silent console shell matching the idle wireframe"],
          ["out", "37010ac Add system core v0 (single R3F canvas)"],
        ]
      : [
          ["out", "a91c2e4 wip (sample)"],
          ["out", "7f03b1d chore: bump deps (sample)"],
        ];
  if (c === "pnpm test" || c === "pnpm vitest" || c === "pnpm test --run")
    return repo === "parallax"
      ? [...PARALLAX_TEST]
      : [
          ["dim", `> ${repo} test`],
          ["ok", " Test Files  6 passed (6)"],
          ["ok", "      Tests  58 passed (58)"],
        ];
  if (c === "pnpm lint") return [["dim", "> eslint ."], ["ok", "✓ no problems"]];
  if (/^lsof -i ?:?3000$/.test(c))
    return [
      ["dim", "COMMAND   PID     USER   FD  TYPE  NODE NAME"],
      ["out", `node    ${STALE_PID} eddwordd  23u  IPv6  TCP  *:3000 (LISTEN)`],
    ];
  return [["dim", `zsh: sample shell · '${c}' echoed, nothing executed`]];
}

function approvedOutput(command: string, reason: string): Spec[] {
  if (/\bpush\b/.test(command)) return [["ok", "✓ approved"], ["dim", "(sample) repo has no remote · nothing pushed"]];
  if (/\brm\b/.test(command)) return [["ok", "✓ approved"], ["dim", "(sample) mock shell · no files touched"]];
  if (/\b(kill|pkill|killall)\b/.test(command)) return [["ok", "✓ approved · SIGTERM sent (sample)"]];
  return [["ok", "✓ approved"], ["dim", `(sample) ${reason} · not executed by the mock shell`]];
}

/* ------------------------------------------------------------------------- */
/* Scripted agent runs                                                        */
/* ------------------------------------------------------------------------- */

const slug = (task: string) =>
  task
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("-") || "task";

/* ------------------------------------------------------------------------- */
/* Bridge                                                                     */
/* ------------------------------------------------------------------------- */

export function createMockDevBridge(snapshot: DevSnapshot): DevBridge {
  const model: DevSnapshot = structuredClone(snapshot);
  const listeners = new Set<(ev: DevEvent) => void>();
  const emit = (ev: DevEvent) => listeners.forEach((fn) => fn(ev));
  const later = (ms: number, fn: () => void) => setTimeout(fn, ms);

  const append = (sessionId: string, specs: readonly Spec[]) => {
    const s = model.sessions[sessionId];
    if (!s) return;
    const ls = lines(Date.now(), specs);
    s.lines.push(...ls);
    emit({ type: "term.append", sessionId, lines: ls });
  };
  const upsertAgent = (a: AgentSession) => {
    const i = model.agents.findIndex((x) => x.id === a.id);
    if (i >= 0) model.agents[i] = a;
    else model.agents.push(a);
    emit({ type: "agent.upsert", agent: a });
  };
  const upsertServer = (s: DevServer) => {
    model.servers = model.servers.map((x) => (x.id === s.id ? s : x));
    emit({ type: "server.upsert", server: s });
  };
  const upsertCi = (r: CiRun) => {
    model.ci = model.ci.some((x) => x.id === r.id) ? model.ci.map((x) => (x.id === r.id ? r : x)) : [r, ...model.ci];
    emit({ type: "ci.upsert", run: r });
  };
  const play = (steps: readonly { ms: number; run: () => void }[]) => {
    let t = 0;
    for (const s of steps) {
      t += s.ms;
      later(t, s.run);
    }
  };

  const killPid = (pid: number) => {
    const srv = model.servers.find((s) => s.pid === pid);
    if (!srv) {
      emit({ type: "notice", text: `kill ${pid} · no such process (sample)`, result: "error" });
      return;
    }
    upsertServer({ ...srv, pid: undefined, state: "free", command: "—", note: undefined });
    emit({ type: "notice", text: `pid ${pid} stopped · :${srv.port} free`, result: "ok" });
  };

  function handle(req: DevRequest) {
    switch (req.type) {
      case "term.exec": {
        const s = model.sessions[req.sessionId];
        if (!s) return;
        const risk = classifyCommand(req.command);
        if (risk.risky && !req.approved) {
          append(s.id, [["err", `✕ refused · ${risk.reason} · needs approval`]]);
          return;
        }
        if (req.command.trim() === "clear") {
          s.lines = [];
          emit({ type: "term.clear", sessionId: s.id });
          return;
        }
        if (risk.risky) {
          append(s.id, approvedOutput(req.command, risk.reason ?? "risky"));
          const pid = /\bkill\b(?:\s+-\S+)*\s+(\d+)/.exec(req.command)?.[1];
          if (pid) later(200, () => killPid(Number(pid)));
          return;
        }
        later(req.command.startsWith("pnpm test") ? 650 : 120, () => append(s.id, respond(s, req.command)));
        return;
      }

      case "agent.respond": {
        const a = model.agents.find((x) => x.id === req.agentId);
        if (!a || a.prompt?.id !== req.promptId) return;
        if (req.answer === "deny") {
          upsertAgent({ ...a, state: "stopped", prompt: undefined, endedAt: Date.now() });
          append(a.sessionId, [["dim", "[q] quit"], ["err", "✕ workspace not trusted · agent exited"]]);
          return;
        }
        upsertAgent({ ...a, state: "running", prompt: undefined });
        append(a.sessionId, [["dim", "[a] trust"], ["ok", "✓ workspace trusted"]]);
        play([
          { ms: 700, run: () => append(a.sessionId, [["sys", `agent · ${a.task}`], ["dim", "  reading AGENTS.md, DESIGN.md, src/lib/store.ts"]]) },
          { ms: 1400, run: () => append(a.sessionId, [["sys", "agent · plan: 3 edits · src/components/console"]]) },
        ]);
        return;
      }

      case "agent.dispatch": {
        const now = Date.now();
        const id = uid("a");
        const sessionId = uid("t");
        const branch = `agent/${slug(req.task)}`;
        const cwd = `${PROJECTS}/${req.repo}`;
        const session: TermSession = { id: sessionId, title: `${req.repo} · ${req.agent}`, cwd, branch, lines: [] };
        model.sessions[sessionId] = session;
        emit({ type: "session.upsert", session: { id: sessionId, title: session.title, cwd, branch } });
        const agent: AgentSession = { id, repo: req.repo, agent: req.agent, branch, cwd, task: req.task, state: "running", startedAt: now, sessionId };
        upsertAgent(agent);
        const sp = { cwd, branch };
        append(sessionId, [
          prompt({ cwd, branch: "main" }, `git switch -c ${branch}`),
          ["dim", `Switched to a new branch '${branch}'`],
          prompt(sp, `${req.agent} "${req.task}"`),
        ]);
        play([
          { ms: 900, run: () => append(sessionId, [["sys", `${req.agent} · reading eslint output (2 problems)`]]) },
          { ms: 1300, run: () => append(sessionId, [["dim", "  ~ src/components/Hero.tsx"], ["dim", "  ~ src/lib/format.ts"]]) },
          { ms: 1400, run: () => append(sessionId, [prompt(sp, "pnpm lint"), ["dim", "> eslint ."], ["ok", "✓ no problems"]]) },
          {
            ms: 1100,
            run: () => {
              append(sessionId, [["sys", `${req.agent} · done · 2 files changed, +6 −3 · ready for review`]]);
              upsertAgent({ ...agent, state: "done", endedAt: Date.now(), diff: { files: 2, additions: 6, deletions: 3 } });
              emit({ type: "notice", text: `${req.repo}/${req.agent} finished · +6 −3`, result: "ok" });
            },
          },
        ]);
        return;
      }

      case "process.kill": {
        if (!req.approved) {
          emit({ type: "notice", text: `kill ${req.pid} refused · needs approval`, result: "denied" });
          return;
        }
        later(250, () => killPid(req.pid));
        return;
      }

      case "server.start": {
        const srv = model.servers.find((s) => s.id === req.serverId);
        if (!srv || srv.state === "running" || srv.state === "starting") return;
        const pid = 40000 + Math.floor(Math.random() * 9000);
        upsertServer({ ...srv, state: "starting", pid });
        if (srv.sessionId) {
          const s = model.sessions[srv.sessionId];
          append(srv.sessionId, [prompt({ cwd: s.cwd, branch: s.branch }, "pnpm dev"), ["dim", "> next dev"]]);
        }
        later(1400, () => {
          upsertServer({ ...srv, state: "running", pid });
          if (srv.sessionId)
            append(srv.sessionId, [
              ["out", "▲ Next.js 16.3.8 (Turbopack)"],
              ["out", `- Local:        http://localhost:${srv.port}`],
              ["ok", "✓ Ready in 980ms"],
            ]);
          emit({ type: "notice", text: `${srv.repo} up on :${srv.port}`, result: "ok" });
        });
        return;
      }

      case "tests.run": {
        const agent = model.agents.find((a) => a.repo === req.repo);
        const run = model.ci.find((r) => r.repo === req.repo);
        if (agent) {
          const s = model.sessions[agent.sessionId];
          append(agent.sessionId, [prompt(s, "pnpm test")]);
          later(900, () => append(agent.sessionId, respond(s, "pnpm test")));
        }
        if (run) {
          const next: CiRun = { ...run, id: run.id, number: run.number + 1, status: "running", summary: "vitest run", at: Date.now() };
          upsertCi(next);
          later(1600, () => {
            const failed = req.repo === "parallax";
            upsertCi({
              ...next,
              status: failed ? "failed" : "passed",
              summary: failed ? "1 failed · 44 passed" : "all passed",
              at: Date.now(),
            });
            emit({
              type: "notice",
              text: `${req.repo} tests · ${failed ? "1 failing (targets.sort.spec.ts)" : "all passed"}`,
              result: failed ? "error" : "ok",
            });
          });
        }
        return;
      }

      case "session.start": {
        const id = req.sessionId ?? uid("t");
        const cwd = `${PROJECTS}/${req.repo}`;
        const session: TermSession = { id, title: `${req.repo} · shell`, cwd, branch: "main", lines: [] };
        model.sessions[id] = session;
        emit({ type: "session.upsert", session: { id, title: session.title, cwd, branch: "main" } });
        append(id, [["dim", "sample shell · nothing runs on any machine · type help"]]);
        return;
      }

      case "sessions.resume": {
        for (const a of model.agents) append(a.sessionId, [["sys", `↺ session reattached · ${a.repo}:${a.agent}`]]);
        emit({ type: "notice", text: `${model.agents.length} sessions reattached`, result: "ok" });
        return;
      }
    }
  }

  return {
    send: (req) => later(60 + Math.random() * 120, () => handle(req)),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
