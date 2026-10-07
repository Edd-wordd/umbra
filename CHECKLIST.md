# Umbra — Living Intake Checklist

> Personal life OS · interactive agent (not a dashboard)  
> Product, bot, and repo: **Umbra**  
> Last updated: 2026-10-05 11:10 PM MT

Use `- [ ]` / `- [x]` to track progress. Update this file as decisions lock.

---

## 1. Product identity

- [x] Product name: **Umbra** (interactive life OS ; bot shares the name)
- [x] Repository name: **umbra**
- [x] Framing: personal life OS — interactive agent, **not** a metrics dashboard
- [x] Primary interaction: silent until touch or voice; centerpiece is a living mesh brain
- [ ] Public-facing README / positioning copy drafted
- [x] Repo scaffold created under `umbra`

---

## 2. Design direction

- [x] Aesthetic: **tactical cyberdeck** — quiet, restrained, ops-console feel
- [x] Default state: **silent / near-black** until touch or voice wakes activity
- [x] Surface: near-black grid, thin lines, monospace type
- [x] Glow palette (activity only): **cyan / amber / red** — no constant neon wash
- [x] Centerpiece: precision **system core** (domain sectors, glow, voice-reactive pulse) that morphs to an **orrery** in Astro mode
- [x] Tron accents used **sparingly** (grid / edge highlights only)
- [x] Explicit rejects:
  - [x] Floating panels / window-clutter HUD
  - [x] Busy sci-fi wallpaper
  - [x] Everything-at-once information density
- [x] DESIGN.md constraints applied to first UI shell
- [ ] Moodboard references reviewed (`references/`)

---

## 3. Sections to build (status)

### Core brain (mesh graph)
- [ ] System core with domain sectors, hubs, and pathways as primary centerpiece
- [ ] Node types / domains mapped (dev, lab, astro, business, life, knowledge…)
- [ ] Morph path: mesh brain ↔ Astro orrery
- [ ] Idle vs active glow states

### Dev rail
- [x] GitHub integration
- [x] Sentry integration
- [x] PostHog integration
- [x] Figma integration
- [x] **NO WakaTime** (explicitly excluded)
- [x] Dev focus **mockup** (sample data): needs-you list (derived), compact project lines, on-demand terminal with risky-command approval, folded ports, per-project service adapters (GitHub solo view, Sentry ↔ CI, PostHog, Supabase, Docker, Figma; `+ service`), hand-off, dispatch, activity strip, core attention
- [x] Decision layer (Jev, TypeSafe System One): server-only `/api/decide`, typed client + Noul/Choice/Score builders, local fallback (`jev` | `local`), Needs-you triage (5 atomic questions → priority + placement), `?mock=events` stream, decisions in the activity log
- [ ] Jev live-tested with a real `TYPESAFE_API_KEY` (built against the documented API; only the local fallback has run so far)
- [ ] Jev: command routing (⌘K / voice → tool), wire `secondRiskCheck` into held commands, Deadbridge lead scoring, Astro go/no-go
- [x] Dev focus on live data: Mac helper (`pnpm helper`) behind the same `DevBridge` interface: projects + agents from open **Herdr** workspaces (socket + CLI fallback), pane output / prompt / keys / focus, blocked agents → Needs you with Approve/Deny keys, ports via lsof (pane-linked, orphans, kill via approval), git per project, gh CI + failing job; LIVE / SAMPLE tag, `mac` health dot; 127.0.0.1 + server-side token + one-time tickets; approval ids for risky actions; audit log
- [ ] Mac helper verified on the real Mac against real Herdr (built and tested on Linux against a mock Herdr made from captured fixtures: socket framing, CLI forms for `focus` / `process-info` / `send-keys`, key names, macOS lsof / gh auth still unproven)
- [ ] Mac helper: Tailscale access (remote devices), launchd install, per-project service config persisted from `+ service`

### Homelab + Network
- [ ] Proxmox status / surfaces
- [ ] Docker host visibility
- [x] AdGuard status / controls

### Print rail
- [ ] Canon imagePROGRAF PRO-1000 via **CUPS / LPR**
- [ ] Job queue / status strip
- [ ] CUPS path / host decision locked (see Open decisions)

### Astro rail
- [ ] Raspberry Pi **INDI** bridge
- [ ] **OnStep** mount control surface
- [ ] **Sony A7 II** capture / status
- [x] **NO KStars** (explicitly excluded)
- [ ] **Parallax** feeds observation targets
- [ ] Weather source TBD (see Open decisions)
- [ ] Mesh → orrery morph for Astro mode

### Business rail
- [ ] Deadbridge — Frappe CRM leads
- [x] Casa Plasencio — **deferred**

### Focus / Ops strip
- [ ] Compact focus / ops strip (not a full dashboard pane)
- [ ] Ties into voice risk-approval and active tasks

### Voice layer
- [ ] LiveKit Agents
- [ ] Wake word
- [ ] Tool calling with **risk approval** gates
- [ ] Silent until wake / explicit activation

### Cameras
- [ ] Camera surfaces defined
- [ ] RTSP / source decision locked (see Open decisions)

### Knowledge (Obsidian)
- [x] Obsidian vault as the human-readable Knowledge layer
- [ ] Treat Obsidian as an authoring layer, **not** the graph database
- [x] Define Obsidian vault ontology/templates before large-scale note ingestion ([`docs/obsidian-knowledge-layer.md`](./docs/obsidian-knowledge-layer.md))
- [x] Define note types: project, area, resource, runbook, decision, incident, session_log, device, person, lead, service
- [x] Define semantic frontmatter fields and stable `umbra_id` conventions
- [x] Define wikilink/frontmatter → brain edge mapping
- [ ] Vault sync path the bridge can read (Syncthing to Proxmox or git)
- [ ] Build Obsidian indexer: typed notes → graph nodes; semantic links/frontmatter → typed edges
- [ ] Build graph query tools for agents: neighbors, paths, related runbooks, related decisions, prior incidents
- [ ] Read, search, open, and write notes ("log tonight's session")

### Mac helper (device agent)
- [ ] Small always-on helper on Edward's Mac so Umbra can open files, apps, and windows
- [ ] Exposes Mac actions as tools through the same tool layer

### Activity log / timeline
- [ ] Every Umbra action logged with time, source (voice or touch), and result
- [ ] Timeline doubles as the brain's memory

### Command palette
- [ ] Cmd-K typed fallback to voice, calling the same tools

### Bridge health
- [ ] Heartbeats for bridge, Pi, Mac helper, printer; a dead device shows as a red node
- [x] Mac helper heartbeat: top-bar `mac` dot (solid = live, hollow = not configured, red = unreachable) + `GET /health` on the helper

### Small Comms strip
- [ ] Minimal comms strip (not a full inbox UI)

### Life Ops (last)
- [ ] Apple Health export ingestion (phase last)

### Desk robot (later phase)
- [ ] Desk robot — later phase only; not in early build

---

## 4. Tech stack

- [x] Frontend: **Next.js + TypeScript + Tailwind**
- [x] 3D / graph: **R3F** single canvas (instanced geometry + glow pass)
- [x] Backend / data: **Supabase**
- [x] Automation: **n8n** on Proxmox Docker
- [x] Local bridge (homelab / device I/O)
- [x] Voice: **LiveKit** (Agents)
- [x] Optional: **Screenpipe MCP**
- [x] Astro: **INDI Web Manager** (Pi)
- [x] Stack versions pinned in repo
- [x] Local bridge protocol / auth sketched (Mac helper: loopback WebSocket, server-side token → one-time tickets, approval ids for risky actions, audit log; see README "Mac helper")

---

## 4b. Foundations to decide before wiring (avoid later pain)

- [x] **Kernel plan**: Phase 0 architecture captured in [`docs/umbra-kernel.md`](./docs/umbra-kernel.md)
- [x] **Knowledge graph ontology**: initial entity types, edge types, stable IDs, and relationship semantics defined before indexing Obsidian
- [x] **Graph traversal tooling**: initial explicit multi-hop queries added instead of grepping YAML or dumping markdown into context
- [x] **Obsidian as authoring layer**: markdown notes feed the graph, but Umbra's typed graph is the machine memory layer
- [ ] **One tool layer**: every action defined once, used by buttons, voice, and Cmd-K
- [ ] **Network access**: Tailscale on Proxmox, Pi, and Mac instead of open ports
- [ ] **Safety on physical actions**: approval levels, hard limits the AI can't override (mount, power, print), audit log
- [ ] **Secrets in one place**: Supabase Vault, 1Password, or Doppler
- [x] **Brain graph data model**: initial typed nodes/edges model added for real things (repo, device, note, lead, session) with live state and defined edges
- [ ] **Offline Astro**: Pi keeps working at a dark site with no internet, syncs later
- [ ] **Cost control**: local wake word so cloud voice and LLM only run when spoken to

---

## 5. APIs / accounts — have vs need

### Have (assumed / already in play)
- [x] GitHub
- [x] Sentry
- [x] PostHog
- [x] Figma
- [x] Supabase project
- [x] Proxmox + Docker (homelab)
- [x] AdGuard
- [x] Canon PRO-1000 on network (CUPS target)
- [x] Pi for INDI / OnStep path
- [x] Sony A7 II
- [x] Deadbridge Frappe CRM
- [x] Parallax (targets feed)

### Need (confirm / provision)
- [ ] LLM provider + keys (see Open decisions)
- [ ] Weather API / source (see Open decisions)
- [ ] Hosting target: Vercel vs Proxmox (see Open decisions)
- [ ] Camera / RTSP endpoints (see Open decisions)
- [ ] Obsidian vault sync path (see Open decisions)
- [ ] Tailscale account
- [ ] Secrets store choice
- [ ] CUPS host / queue path for PRO-1000 (see Open decisions)
- [ ] INDI Web Manager status / URL on Pi (see Open decisions)
- [ ] Optional Screenpipe MCP setup
- [ ] LiveKit account / project
- [ ] Wake-word model / LiveKit Agents config

> Mark each item `[x]` under Have once verified; move Need → Have as credentials land.

---

## 6. Build phases (order)

- [x] **Phase 0a — UI foundations**  
  Repo, Next.js shell, DESIGN constraints, near-black silent canvas, mono type, grid
- [x] **Phase 0b — Kernel / ontology planning**  
  Product stance, core primitives, status/risk taxonomies, ontology, graph semantics, traversal design, situation model, action lifecycle, memory model, Obsidian role, build order. See [`docs/umbra-kernel.md`](./docs/umbra-kernel.md).
- [x] **Phase 1 — Typed brain graph**  
  Initial `src/lib/brain` foundation: typed nodes, edges, stable IDs, graph queries, traversal helpers, graph snapshots, sample brain pipeline.
- [ ] **Phase 2 — Dev graph adapter + situations**  
  Convert existing Dev sample/live data into graph entities/signals. Initial adapter and situations exist; expand grouping/lifecycle for blocked agent, failed CI, stale port, dirty repo, local-only work at risk, service attention.
- [ ] **Phase 3 — Action/tool kernel**  
  Implement one action lifecycle used by buttons, Cmd-K, voice, agents, and runbooks. Add dry-run, risk check, approval, verify, audit.
- [ ] **Phase 4 — Memory/timeline**  
  Initial MemoryEvent model and timeline helpers exist. Expand into situation replay and "What changed since I left?"
- [ ] **Phase 5 — Visual brain from graph**  
  Render the center system core from real graph state: domains, entities, relationships, situations, attention color, voice pulse, Astro orrery path.
- [ ] **Phase 6 — Obsidian typed authoring layer**  
  Define vault templates, parse typed markdown/frontmatter, map notes to graph nodes, map semantic links to graph edges, expose graph query tools to agents.
- [ ] **Phase 7 — Homelab + Network**  
  Proxmox, Docker, AdGuard, Tailscale, service health, backup state, runbooks.
- [ ] **Phase 8 — Print**  
  CUPS/LPR, Canon PRO-1000, queue, readiness check, print staging, physical-action approval.
- [ ] **Phase 9 — Astro**  
  INDI, OnStep, Sony A7 II, Parallax targets, weather, readiness check, mesh → orrery.
- [ ] **Phase 10 — Business**  
  Deadbridge Frappe leads, lead scoring, draft follow-up, no auto-send without approval.
- [ ] **Phase 11 — Cameras**  
  RTSP/source health and minimal camera surfaces.
- [ ] **Phase 12 — Life Ops**  
  Apple Health export ingestion, last.
- [ ] **Phase 13 — Desk robot**  
  Later phase only.

---

## 7. Open decisions

- [ ] **Secrets store** — Supabase Vault vs 1Password vs Doppler
- [ ] **LLM** — provider, models, local vs cloud, cost / privacy stance (talking only; decisions go to Jev)
- [ ] **Weather source** — for Astro (API TBD)
- [ ] **Hosting** — Vercel vs Proxmox (or hybrid)
- [ ] **Cameras / RTSP** — sources, auth, retention
- [ ] **Obsidian vault sync** — Syncthing vs git, location on Proxmox
- [ ] **CUPS path** — host, queue name, LPR URI for PRO-1000
- [ ] **INDI status on Pi** — Web Manager up? URL? OnStep device mapping?

---

## 8. Explicitly out of scope / deferred

- [x] **WakaTime** — not in Dev rail
- [x] **KStars** — not in Astro stack (INDI / OnStep / Parallax instead)
- [x] **Casa Plasencio** — deferred (Business rail = Deadbridge CRM only for now)
- [x] Floating-panel / busy sci-fi wallpaper UI
- [x] Everything-at-once dashboard density
- [x] Desk robot — later phase only
- [x] Life Ops / Apple Health — last among life surfaces
- [ ] Any other exclusions discovered in build → add here

---

## Quick links

- Design constraints: [`DESIGN.md`](./DESIGN.md)
- Moodboard: [`references/`](./references/) · [`references/SOURCES.md`](./references/SOURCES.md)
