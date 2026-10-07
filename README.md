# Umbra

Edward's personal life OS: a quiet, tactical desk console with a living mesh brain at its center, edge rails for Dev, Homelab/Network, Print, Astro, Business, Cameras, and Knowledge, and a voice agent that can act on his systems.

- Plan and status: [CHECKLIST.md](./CHECKLIST.md)
- Design rules: [DESIGN.md](./DESIGN.md)
- Moodboard: [references/](./references/)
- Wireframes: [wireframes/](./wireframes/)

Status: Phase 0 (foundations). Next.js console shell with the idle layout, rails, ⌘K palette and the system core v0, plus a lean **Dev focus** (recent pings + one line per project) fed by the **Mac helper** (see below) from Herdr, lsof, git and gh. The Dev focus never shows sample data; everything else is SAMPLE.

## Run locally

Requirements: **Node.js 22 LTS** (see `.nvmrc`; anything `>=20.9.0` works, per `engines`) and **pnpm 10** (`corepack enable`, or `npm i -g pnpm`).

```bash
nvm use          # optional, picks up .nvmrc
pnpm install
pnpm dev         # http://localhost:3000
```

Other scripts: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm start`.

### Keys

| Key | Action |
|---|---|
| `⌘K` / `Ctrl-K` | Open / close the command palette (tools from the shared tool layer) |
| `Esc` | Close the palette, or collapse the awake rail / voice back to idle |
| Click a rail tick | Wake only that rail; click outside, `Esc`, or 20 s idle collapses it |
| `V` | Dev only: toggle a simulated speaking envelope (voice pulse on the core) |
| `Shift-V` | Dev only: cycle voice states idle → listening → thinking → speaking |

`V` / `Shift-V` work under `pnpm dev`; in a production build add `?dev` to the URL.

Deep links: `/?focus=dev` (or `/?rail=dev`) opens the Dev focus (`&helper=off` skips the helper, e.g. to see the not-connected line); `/?rail=<id>` wakes any rail.

### Dev focus

Clicking the DEV tick opens the Dev rail as a workspace instead of the narrow panel. It stays awake while open (no 20 s collapse, no click-outside close); `Esc`, `esc ✕` or the DEV tick closes it. It is one slim column beside a large core. It only reads and jumps: no terminal, no prompt box, no approvals. A good day looks nearly empty.

It shows live data from the Mac helper (next section) and nothing else. Until the helper's first snapshot arrives it shows one quiet `connecting…` line; if the helper isn't configured or running it says so in one line (`start it with pnpm helper`). The header tag reads `LIVE · MAC` while connected.

- **Pings** (top): the helper's recent pings, newest first (8 at most): project color dot, title and short message, relative time, `↗`. Clicking a row follows its jump link (Herdr / Cursor jumps act in place; localhost and GitHub links open a tab). None: "Nothing needs you."
- **Projects**: one line per repo from the open Herdr workspaces (two workspaces on one repo = one line, `parallax ×2`): color dot and name, `2 agents · 1 working` (blocked in amber, failed in red), git in a few chars (`~3` uncommitted files, `↑2` unpushed commits, `↓1` behind), a CI dot when known (red failed, cyan running, hollow passed), and jumps: `herdr ↗` (focuses the blocked agent's pane, else a working one, else the first), `cursor ↗`, and `localhost:PORT ↗` only while a server listens.
- **Drawer**: click a project line for a little more: each agent (`cursor ws 6`, status, task title or the question it's blocked on, its own `herdr ↗`), branch, git counts, stale branches, the latest CI run (`github ↗`), and listening ports with `localhost:PORT ↗`. `✕` or clicking the line again closes it.
- **Brain tie-in**: a blocked agent puts an amber bracket on the core's Dev sector and a dot on the DEV tick (red for a failed agent or failed CI), even at idle.
- **⌘K**: `dev.focus.open`, `dev.projects.open` (opens a project's drawer).

Code: `src/components/console/devfocus/` (`DevFocus.tsx`, `Pings.tsx`, `Projects.tsx`, `ProjectDrawer.tsx`, `ui.tsx`, `project.ts`, `layout.ts`), `src/lib/dev/` (`store.ts` reducer over helper events, `live.ts` socket client, `types.ts` the protocol subset it reads, `helper-protocol.check.ts`, `colors.ts`, `format.ts`).

### Mac helper (live Dev data)

`helper/` is a small local Node program (TypeScript, only dependency `ws`) that runs on the Mac and feeds the Dev focus real data. When it stops, the Dev focus clears to its not-connected line and reconnects by itself.

**Run it (on the Mac, from the repo root):**

```bash
pnpm install
pnpm helper        # first run creates helper/umbra.helper.json with a new token and prints two lines
```

Paste the two printed lines into `.env.local` in the repo root (gitignored; create it if needed):

```bash
UMBRA_HELPER_URL=http://127.0.0.1:7317
UMBRA_HELPER_TOKEN=<the long token it printed>
```

Then (re)start the app in a second terminal and open the Dev focus:

```bash
pnpm dev           # restart it if it was already running: .env.local is read at startup
```

The header tag turns `LIVE · MAC` and the top bar's `mac` dot is solid (hollow = not configured, red = configured but unreachable). Print the lines again any time with `pnpm helper --print-env`. Keep `pnpm helper` running in its own terminal, or have it start at login with `pnpm helper:install-login` (writes `~/Library/LaunchAgents/com.umbra.helper.plist` from `helper/launchd/com.umbra.helper.plist.example` and bootstraps it; logs in `~/Library/Logs/umbra-helper.log`; `pnpm helper:uninstall-login` undoes it; rerun the install after pulling changes or switching node versions). `?helper=off` skips the helper.

**Where the data comes from:**

- **Projects and agents: Herdr.** The project list is the distinct git roots of the Herdr workspaces you have open (two parallax workspaces = one project, shown as `parallax ×2`, labeled with the workspace label; its agents read `cursor ws 1` / `cursor ws 6`). Each project has a stable accent color (hash of the repo name into a small palette; red / amber / green stay status). Open a workspace on a repo and it appears; close it and it goes away. Agents are Herdr's own records (pane, workspace, `agent_status`, terminal title): `working`, `blocked` (amber), `idle` / `done`. The helper talks to Herdr's socket (`~/.config/herdr/herdr.sock`, newline-delimited JSON, with `events.subscribe` for instant updates) and polls `session.snapshot` every 2 s; if the socket doesn't answer it falls back to the `herdr` CLI (`herdr api snapshot`, `pane read`, `agent prompt`, …). If Herdr isn't running it watches `fallbackProjects` instead and spots agents by process name (no output, read-only).
- **Ports**: `lsof -nP -iTCP -sTCP:LISTEN`, each process's cwd mapped to a project, and traced to the Herdr pane that started it (`pane.process_info`). Stale = a dev-like server no pane owns that is orphaned (parent gone), idle for 8 h+, or outside any open project for 2 h+.
- **Git** per project (every 30 s + a file watch on `.git`): branch, uncommitted, ahead/behind, unpushed commits and the oldest one's age, no-remote, branches older than 14 days, last commit.
- **CI**: `gh run list` (latest run) + `gh run view` for the failing job › step, open PR count. If `gh` isn't installed or logged in, CI shows as unknown (`gh auth login` fixes it).

**Pings** (native Mac notifications; Umbra otherwise stays out of the way):

| Trigger | When | Jump link opens | Default |
|---|---|---|---|
| `agentBlocked` | a Herdr agent goes `blocked` (also at helper start if one already is) | that agent's Herdr pane, terminal to the front | on |
| `agentDone` | an agent goes `working` → `done`, or ends idle with `completion_seq` advancing | that pane | on |
| `serverDied` | a project's dev server (listening ≥ 60 s) stops listening and wasn't stopped on purpose (KILL / ctrl+c from Umbra, a `^C` in its pane, pane or project closed); verdict after 20 s | `localhost:PORT` if it came back, else the project in Cursor | on |
| `ciFailed` | the repo's latest GitHub Actions run failed (runs older than 6 h at first sight are skipped) | the run on GitHub | on |
| `staleWork` | uncommitted (or, with a remote, unpushed) work older than `staleWorkDays` (3) | the oldest repo in Cursor · at most one ping a day | off |

Never twice: each event has a key (pane + Herdr seq, run id, port + time, date) remembered 48 h across restarts (`helper/logs/pings.json`), plus a 5 min cooldown per agent / port / repo. `quietHours` (off by default, e.g. 22:00–08:00) records pings without showing them. Delivery: `terminal-notifier` when installed (**`brew install terminal-notifier`**, clickable, newer pings replace older ones about the same thing), else `osascript` (shows, but a click can't open the link: use the recent list at `http://127.0.0.1:7317/pings`). Titles start with the project's accent emoji and name. Try it: `pnpm helper --test-ping` (sends one ping whose link opens umbra in Cursor; if a helper is already running, that one sends it).

**Jump links**: `GET http://127.0.0.1:7317/jump/<token>`. The token is random, single-purpose and lasts 24 h; it maps to one fixed action: focus a Herdr pane (`herdr agent focus <target>` / socket `agent.focus`; plain panes `pane.focus`, or `herdr tab focus <tab>` over the CLI) then `open -a <jumpTerminalApp>` (`jumpTerminalApp`: the example config sets `"iTerm"`, where Herdr runs; `"auto"` picks iTerm if `open -Ra iTerm` finds it, then Ghostty, then Terminal); open a project in Cursor (`cursor <dir>` or `open -a Cursor <dir>`); or a 302 to `http://localhost:PORT` / a github.com page. Loopback peers with a `127.0.0.1` / `localhost` Host header only; no commands, no paths from the request. Each jump is audited. The page says what it did and tries to close itself. The Dev focus uses the same actions: ping rows follow their link, project lines and the drawer send `herdr ↗` / `cursor ↗` over the socket, and `localhost:PORT ↗` is a plain link.

**Security:**

- Listens on **127.0.0.1 only** (the config refuses anything else). Tailscale later.
- The long-lived token lives in `helper/umbra.helper.json` (mode 600) and in `.env.local`, read **server-side only** by `src/app/api/helper/*`. The browser asks `/api/helper/session` for a single-use socket ticket (60 s) and connects straight to `ws://127.0.0.1:7317`, so only the Mac itself can drive it, even though `next dev` listens on the LAN. The routes also reject non-localhost Host headers and cross-origin requests.
- The Dev focus only sends jump requests. The helper still enforces its own command policy for its other socket requests (terminal, agent keys, kill, …, kept for later use): reading is free; risky actions (kill, `git push`, `rm`, `reset --hard`, `--force`, restart, `sudo`, `launchctl`, `docker stop`, …) need a one-shot approval id from its authed `POST /approvals`. Without one, it refuses.
- Every action (and every refusal and issued approval) is appended to `helper/logs/audit.jsonl` (gitignored).
- Umbra never closes Herdr workspaces, stops Herdr or starts agents in it.

**Config** (`helper/umbra.helper.json`, gitignored; see `helper/umbra.helper.example.json`): `port`, `token`, `herdr` (`transport` auto | socket | cli | off, `socket`, `bin`), `projects` (optional per-project overrides keyed by repo folder name or `path`: `services`, `dev` `{command, port}`, `test`), `fallbackProjects` (watched only without Herdr), `ignorePorts`, poll intervals, `staleBranchDays`, `recentHours`, `pings` (`enabled`, one switch per trigger, `staleWorkDays`, `cooldownMinutes`, `serverGraceSeconds`, `serverMinUpSeconds`, `quietHours {enabled, start, end}`, `notifier` auto | terminal-notifier | osascript | off, `sound`), `jumpTerminalApp` (`"iTerm"`, `"Ghostty"`, `"Terminal"`, … or `"auto"` = iTerm, then Ghostty, then Terminal; the example sets `"iTerm"`). Restart the helper after editing.

**Code:** `helper/src/` holds `main.ts` (entry), `server.ts` (HTTP + WebSocket, tickets, approvals), `helper.ts` (model, collectors, request handling), `herdr.ts` (socket + CLI client), `projects.ts` (workspaces → projects), `procs.ts` (ps / lsof), `git.ts`, `ci.ts`, `policy.ts`, `audit.ts`, `sessions.ts` (helper-owned shells via `script(1)`), `pings.ts` (triggers, dedup, quiet hours), `notify.ts` (terminal-notifier / osascript), `jumps.ts` (tokens + the fixed jump actions), `colors.ts` (project accents, shared with the app), `protocol.ts` (wire types; `src/lib/dev/helper-protocol.check.ts` fails typecheck if they drift from the app's). App side: `src/lib/dev/live.ts` (socket client), `src/lib/helper/server.ts` + `src/app/api/helper/session`. Tests without Herdr: `helper/test/mock-herdr.mjs` (socket server built from a captured snapshot), `herdr-cli.mjs` (CLI stand-in), `smoke.mjs` (scripted client), `pings.test.mjs` (`pnpm helper:test`: flips mock agents to blocked / done, kills a dev server, follows the jump links; `UMBRA_PINGS_FILE` stubs the notifier, `UMBRA_JUMP_DRYRUN=1` stubs `open`).

### Layout

```
src/app/                 Next.js App Router (layout, page, design tokens in globals.css)
src/components/console/  Console shell: top chrome, rails, rail panel, bottom strips, ⌘K palette
src/components/core/     System core: one R3F canvas (client-only), shaders, SVG label overlay
src/lib/graph/           Typed graph model (nodes/edges), SAMPLE dataset, deterministic core layout
src/components/console/devfocus/  Dev focus workspace (recent pings, project lines + drawer)
src/lib/tools/           One tool layer: typed Tool (id, domain, risk, run), stub tools, approval gate
src/lib/dev/             Dev view store (reducer over helper events), protocol subset (types.ts), accents, formatting
src/lib/dev/live.ts      Live client (Mac helper over a loopback WebSocket, tickets from /api/helper/session)
src/app/api/helper/      Server route: socket tickets (reads UMBRA_HELPER_TOKEN; never sent to the browser)
helper/                  Mac helper (pnpm helper): Herdr, lsof, git, gh → the Dev focus; pings + jump links; audit log
src/lib/store.ts         Mode store (zustand): idle | rail:<id> | voice | astro
src/lib/voice/level.ts   Voice level bus (0..1) feeding the core's uLevel uniform
```
