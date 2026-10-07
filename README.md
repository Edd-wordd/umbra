# Umbra

Edward's personal life OS: a quiet, tactical desk console with a living mesh brain at its center, edge rails for Dev, Homelab/Network, Print, Astro, Business, Cameras, and Knowledge, and a voice agent that can act on his systems.

- Plan and status: [CHECKLIST.md](./CHECKLIST.md)
- Design rules: [DESIGN.md](./DESIGN.md)
- Moodboard: [references/](./references/)
- Wireframes: [wireframes/](./wireframes/)

Status: Phase 0 (foundations). Next.js console shell with the idle layout, rails, ⌘K palette and the system core v0, plus an interactive **Dev focus** mockup (agents + terminal). All data is SAMPLE.

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

Deep links for demos: `/?focus=dev` (or `/?rail=dev`) opens the Dev focus (`&mock=quiet` good day, `&mock=events` streamed sample events); `/?rail=<id>` wakes any rail.

### Dev focus (MOCK)

Clicking the DEV tick opens the Dev rail as a workspace instead of the narrow panel. It stays awake while open (no 20 s collapse, no click-outside close); `Esc`, `esc ✕` or the DEV tick closes it. By default it is one slim column beside a large core; selecting a need, project, session or server slides a detail panel open to its right (`✕` / CLOSE / deselect collapses it again) and the core moves over and shrinks.

Everything is SAMPLE data from `src/lib/mock/dev.ts`; nothing runs a process, opens a socket or touches the filesystem.

The default view is deliberately short: what needs you, one line per project, everything else one click away. `/?focus=dev&mock=quiet` loads a good-day sample (all quiet).

- **Needs you** (top): triaged by the decision layer (see *Decision layer (Jev)* below). Candidates are derived from live state (`src/lib/dev/needs.ts`), never hand-listed: an agent waiting on you (inline Approve / Deny), a failed agent (its CI run and Sentry issue fold into the same line; `≈ SAMPLE-7Q` opens the project), a stale port holder (Kill → amber approval → `dev.port.free`), a held terminal command, and any service need (an adapter's attention/broken status, e.g. umbra "6 commits not backed up · no remote"). Nothing pending shows one calm "all quiet" line.
- **Projects**: one line per repo (`src/lib/dev/projects.ts`). Healthy = gray dot + name + tiny summary; only attention/broken services get an amber/red chip. Running agents are a small cyan marker (click → its session); running ports are cyan `:3002` (click → its log); `+` (on hover) attaches an unused adapter. Click a line to open the project on the right: its sessions (agents, dev servers, Diff / Start) and the service cards (GitHub solo view, Sentry ↔ CI, PostHog, Supabase, Docker containers, Figma). `×` on a card detaches it.
- **Terminal** (on demand): hidden until you pick a need, an agent marker, a session or a server; `✕` hides it again. Plain DOM transcript plus a command line (`help` lists the sample commands, `↑`/`↓` history). Commands with `rm`, `push`, `--force`, `reset --hard`, `kill` or `sudo` are held behind an amber "needs your yes" strip (`y ⏎` approves, `n` / `Esc` denies).
- **Servers**: one muted `servers · 1 running` line that expands to the port list (Kill / Start, project containers under their dev server). General Docker stays on the Homelab rail.
- **Where you left off**: a 1–3 line card on the first open only; folds after the first click or 30 s. Reopen with `left off ↺` in the header or ⌘K "Where I left off".
- **Send to agent**: one quiet input line at the bottom of the left column (or ⌘K "Send to agent…"); the new agent's session opens in the terminal. Click the repo / agent names to change the target.
- **Activity**: a single latest-line strip at the bottom; click it for the full log.
- **Brain tie-in**: a failed or waiting agent puts a red / amber bracket on the core's Dev sector and a dot on the DEV tick, even at idle.
- **⌘K**: `dev.focus.open`, `dev.projects.open` (Open Dev projects), `dev.handoff.open` (Where I left off), `dev.dispatch.focus` (Send to agent…), `dev.tests.run` (Run parallax tests), `dev.ci.rerun` (Rerun failing CI, needs confirm), `dev.port.free` (Free port 3000, needs confirm), `dev.sessions.resume`. Service card links go through `dev.link.open` (logs only; there is no browser in the mockup).

#### Adding a service

Services are adapters in `src/lib/dev/services/`, one file each (`github`, `sentry`, `posthog`, `supabase`, `docker`, `figma`). An adapter declares `id`, `label`, `chip`, `blurb` and a `read(payload, ctx)` that returns `{ status: ok | active | attention | broken | idle, summary, rows, actions?, needs?, fyi? }`. An attention/broken status shows up under Needs you automatically (from `summary`); return explicit `needs` (with `refs` so it folds into a matching failed agent) or set `fyi: true` for chip-only attention such as a traffic spike. `ctx` carries the project, CI runs, dev servers and agents for cross-links.

1. Add `src/lib/dev/services/<name>.ts` using `defineService<YourPayload>({ ... })`. Return `notConnected(label)` when the payload is missing.
2. Register it in `SERVICES` in `src/lib/dev/services/index.ts`.
3. Add sample data for it in `src/lib/mock/services.ts`, keyed by repo (the Mac-helper bridge will serve the same shape later).
4. List it in the `services` of the projects that use it in `src/lib/dev/projects.ts` (or attach it at runtime with `+ service`).

Nothing else changes: chips, the project drawer and the picker all read from the registry.

### Decision layer (Jev)

Umbra's decisions (what deserves Edward's attention, and later command routing, a second risk check, Deadbridge lead scoring and Astro go/no-go) come from TypeSafe's **Jev** model via the System One API. Jev *decides*; a normal chat LLM will *talk* (not wired yet). Docs: <https://docs.typesafe.ai>.

**Enable it:** put your key in `.env.local` (gitignored; see `.env.example`) and restart `pnpm dev`:

```bash
TYPESAFE_API_KEY=ts_...
```

The key is read **only on the server**, in `src/app/api/decide/route.ts`; the browser only ever talks to `/api/decide` and never sees it. `GET /api/decide` returns `{ jev: true|false, model }` so you can check it's picked up. With no key, or when Jev errors or takes longer than 1.5 s, Umbra answers with a deterministic local heuristic instead. Every decision is marked `jev` or `local` (the hover reason and the activity log show which one).

**Needs-you triage.** Each candidate (derived needs + streamed events) gets five atomic questions in one call: `needs_attention` (Noul: look within the hour?), `urgency` (Score, 5 levels: noise → critical), `category` (Choice: act-now / today / fyi / ignore), `self_fixable` (Noul: one reversible action, no decision needed?) and `affects_people` (Noul: visitors, a client, a waiting lead?). Code combines them (`src/lib/decide/triage.ts`, `TRIAGE_POLICY`):

- `priority = 0.35·attention + 0.35·urgency/4 + 0.2·E[category weight] + 0.1·affects_people`; confidence = mean of the score / choice / Noul confidences.
- **Needs you** if priority ≥ 0.55 or a confident act-now; an agent blocked on your answer always goes there (code rule). Unsure (confidence < 50%) with priority ≥ 0.35 is still shown, with a small `?`.
- **Project chip** if priority ≥ 0.22 and the event has a repo; otherwise **activity log only**.
- Needs you shows the top 3 by priority, then `+N more`. Hover a line for the reason, e.g. `jev · urgent 4/5 · 83%`. When `self_fixable` ≥ 60% and the event has a one-action fix, a FIX button holds it behind the usual "needs your yes" strip.
- Decisions are cached per event id (and server-side for 10 min per identical request), and each one is written to the activity log.

`/?focus=dev&mock=events` loads the quiet sample and streams 10 sample events (CI failed, agent waiting, agent done, container restarting 4×, Sentry spike, new Deadbridge lead, unpushed work, traffic spike, dependabot patch, stale port) about every 3.5 s.

**Code:** `src/lib/decide/` holds `types.ts` (API shapes), `questions.ts` (Noul / Choice / Score builders + confidence math), `jev.ts` (server-only HTTP client), `decide.ts` (server `decide()` with fallback + cache), `tasks.ts` (the only tasks the route accepts: `triage`, `risk`), `client.ts` (browser → `/api/decide`, local fallback), `store.ts` (decision cache + logging) and `risk.ts` (an unwired `secondRiskCheck()` next to the keyword classifier). To add a decision, add a task to `tasks.ts` with `parse`, `build` (state + questions) and `local`.

### Layout

```
src/app/                 Next.js App Router (layout, page, design tokens in globals.css)
src/components/console/  Console shell: top chrome, rails, rail panel, bottom strips, ⌘K palette
src/components/core/     System core: one R3F canvas (client-only), shaders, SVG label overlay
src/lib/graph/           Typed graph model (nodes/edges), SAMPLE dataset, deterministic core layout
src/components/console/devfocus/  Dev focus workspace (needs you, project lines + drawer, on-demand terminal, folded servers / hand-off / dispatch / activity)
src/lib/decide/          Decision layer (Jev): API types, question builders, server client + decide(), tasks, browser client, triage store
src/app/api/decide/      Server route for decisions (reads TYPESAFE_API_KEY; the key never reaches the browser)
src/lib/dev/signals.ts   Dev signals (derived needs + streamed events) the decision layer triages
src/lib/mock/events.ts   SAMPLE event stream for `?mock=events`
src/lib/tools/           One tool layer: typed Tool (id, domain, risk, run), stub tools, approval gate
src/lib/dev/             Dev workspace models + bridge protocol (types.ts), risk classifier, store (reducer over bridge events)
src/lib/dev/projects.ts  Repos and the services each one uses
src/lib/dev/needs.ts     "Needs you" derivation (agents, ports, held commands, service needs)
src/lib/dev/services/    Service adapter registry (one file per service + index.ts)
src/lib/mock/dev.ts      SAMPLE dev data + in-memory bridge with the same interface the Mac helper will implement
src/lib/mock/services.ts SAMPLE per-repo service payloads
src/lib/store.ts         Mode store (zustand): idle | rail:<id> | voice | astro
src/lib/voice/level.ts   Voice level bus (0..1) feeding the core's uLevel uniform
```
