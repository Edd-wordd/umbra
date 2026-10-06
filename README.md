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

Deep links for demos: `/?focus=dev` (or `/?rail=dev`) opens the Dev focus; `/?rail=<id>` wakes any rail.

### Dev focus (MOCK)

Clicking the DEV tick opens the Dev rail as a workspace instead of the narrow panel. It stays awake while open (no 20 s collapse, no click-outside close); `Esc`, `esc ✕` or the DEV tick closes it. The core slides right and shrinks so the brain stays visible.

Everything is SAMPLE data from `src/lib/mock/dev.ts`; nothing runs a process, opens a socket or touches the filesystem.

- **Agent watch**: coding agents per repo (running cyan, waiting amber, failed red, done gray). Click a row to attach its session to the terminal. The waiting agent has inline Approve / Deny; done has Review diff; failed links its Sentry issue.
- **Terminal**: plain DOM transcript of the selected session plus a command line (`help` lists the sample commands, `↑`/`↓` history). Commands with `rm`, `push`, `--force`, `reset --hard`, `kill` or `sudo` are held behind an amber "needs your yes" strip (`y ⏎` approves, `n` / `Esc` denies).
- **Dev servers / ports**: click a server to see its log; Kill on the stale `:3000` process goes through the same approval, then the `dev.port.free` tool; Start brings up deadbridge-site on `:3001`.
- **Build / CI**: a failing run shows its test and the matching Sentry issue; click `excerpt` to open the error under the terminal.
- **Where you left off**: last session per repo; Resume sessions reattaches them and folds the card.
- **Send to agent**: one line starts a new agent on its own branch (it lands on top of the watch list and finishes in a few seconds). Click the repo / agent names to change the target.
- **Activity**: every action is logged with a timestamp, source and result.
- **Brain tie-in**: a failed or waiting agent puts a red / amber bracket on the core's Dev sector and a dot on the DEV tick, even at idle.
- **⌘K**: `dev.focus.open`, `dev.tests.run` (Run parallax tests), `dev.port.free` (Free port 3000, needs confirm), `dev.sessions.resume`.

### Layout

```
src/app/                 Next.js App Router (layout, page, design tokens in globals.css)
src/components/console/  Console shell: top chrome, rails, rail panel, bottom strips, ⌘K palette
src/components/core/     System core: one R3F canvas (client-only), shaders, SVG label overlay
src/lib/graph/           Typed graph model (nodes/edges), SAMPLE dataset, deterministic core layout
src/components/console/devfocus/  Dev focus workspace (agents, terminal, ports, CI, hand-off, dispatch, activity)
src/lib/tools/           One tool layer: typed Tool (id, domain, risk, run), stub tools, approval gate
src/lib/dev/             Dev workspace models + bridge protocol (types.ts), risk classifier, store (reducer over bridge events)
src/lib/mock/dev.ts      SAMPLE dev data + in-memory bridge with the same interface the Mac helper will implement
src/lib/store.ts         Mode store (zustand): idle | rail:<id> | voice | astro
src/lib/voice/level.ts   Voice level bus (0..1) feeding the core's uLevel uniform
```
