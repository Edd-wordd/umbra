# Umbra — Design Constraints

> Binding rules for any future UI work. Prefer silence and restraint over spectacle.

## Product stance

- **Umbra** is an interactive personal life OS agent — not a dashboard, not a widget wall.
- Default mode is **quiet**. The UI does not perform until touch or voice invites it.

## Visual system ("Dataland")

The look follows Michael Rigley's Dataland reel (`/workspace/ref-reel`, frames in `ref-reel/frames`): monochrome white and grays on pure black, tiny outlined glyph tiles, solid white bars, thin curved light threads, wide-tracked uppercase labels in key/value columns. Restrained, precise, lots of black.

| Rule | Constraint |
|------|------------|
| Background | Pure black `#000`. The grid is a barely-there 240px lattice (alpha .014), never wallpaper. |
| Linework | 1px hairlines; zero radius; square dots and tiles, never circles. |
| Type | Mono everywhere. Labels: the `label` utility (9px, uppercase, `letter-spacing: .24em`) laid out as key/value columns: `PARALLAX  CI FAILED  1/45`. Running text and terminal output stay lowercase for legibility. |
| Color | **White = active** (on, running, selected, lit sector). **Grays = idle** (ghost `#3d3d3d`, dim `#5c5c5c`, mid `#8f8f8f`, ink `#d4d4d4`). **Red `#ff3b30` = broken**, the only real accent. **Amber `#d6a248` = needs you**, used sparingly (a 2px notch, a state word, an approval bar), never as fill. No cyan. |
| Glyph tiles | `src/components/ui/Glyph.tsx`: a tiny outlined box with a 1–4 char code (`G` github, `S` sentry, `P` posthog, `SB` supabase, `D` docker, `F` figma, `AG` agent, `:3002` port, `$` held command). States: idle gray outline · ok lighter outline · active solid white with black code · attention white outline + amber notch · broken red outline + red notch. Use it for services, agents, servers, tool domains. |
| Bars | Status / progress are solid white bars on a hairline track (`Bar`, Focus strip). |
| Glow | Only a faint white bloom on active things and the core's voice halo. No neon. |
| Glitch | `useGlitch` / `.umbra-glitch` (chromatic split + band clip, ~210ms) and `.umbra-scan` (scanline flash, ~220ms) fire **once on a state change** (row turns red, panel opens, core attention changes). Never continuous, off under `prefers-reduced-motion`. |
| Density | Show what the active rail needs. Dense is fine inside the core; chrome stays sparse. |

Old cyberdeck tokens (before `design/dataland`, kept for reference): bg `#060708`, panel `#08090b`, line `#1d2024`, ghost `#2a2e33`, dim `#4a5058`, mid `#7d848c`, ink `#aab1b9`, core `#9aa3ad`, **cyan `#3fe3ff` = active**, amber `#ffb648`, red `#ff5252`, 40/200px grid at alpha .028/.055, cyan glow. Revert by checking out `main`.

## Centerpiece

- The **system core** (the "brain") is a small "data city": every graph node is an outlined glyph tile. Tiles group into seven districts (one per domain) around a 3×3 nucleus; each district is an orthogonal block whose towers are entities and whose stacks are their children, with record micro-bars at the base. Thin curved light threads (tapered alpha) tie hubs to the nucleus, towers to hubs, and related nodes across districts. A very faint far field of distant towers gives depth (never lit, not data).
- A lit (awake) district turns white and some towers fill solid; broken tiles are red outlines with a red notch; attention is an amber notch plus pulsing corner brackets on the district hub.
- As the graph grows the core gets **denser, not larger**: more and thinner towers, taller stacks, more threads in the same footprint (`src/lib/graph/tiles.ts`).
- Voice: a soft white halo bloom plus a brightening wave through the tiles, both driven by the single `uLevel` uniform.
- One R3F canvas, one instanced draw for all tiles, one LineSegments for threads; DPR ≤ 1.5; ~10fps idle tick, full rate only while transitioning or speaking.
- In **Astro** mode the core should still morph into an orrery (not yet rebuilt for Dataland).

## Layout

- Rails and strips (Dev, Homelab, Print, Astro, Business, Focus/Ops, Comms) are **secondary** to the brain.
- Prefer edge rails and thin status strips over floating panels.
- No stacked translucent HUD windows. No cluttered sci-fi chrome.

## Interaction

- Silent until **touch** or **voice** (LiveKit wake word / Agents).
- Tool calls that carry risk require **explicit approval** in the UI.
- White / amber / red signal state; idle chrome stays gray. A state change may glitch once; nothing loops.

## Explicit rejects

- Floating panels / window salad
- Busy sci-fi wallpaper or full-bleed cityscapes (the core's far field stays faint and only around the core)
- Rainbow neon / always-on glow
- Dashboard-first information density
- Decorative motion that does not encode state

## Stack cues (visual)

- **R3F** (single WebGL canvas, instanced geometry, one bloom or shader glow) for the core and orrery
- Tailwind tokens encode the black + gray + white/red(+amber) palette (`src/app/globals.css`, mirrored for WebGL in `src/lib/theme/tokens.ts`)
- UI copy stays short, ops-toned, monospace-friendly

## Reference moodboard

See `references/` and `references/SOURCES.md`, plus the Dataland reel frames in `/workspace/ref-reel/`. New UI should be checkable against those stills: if it looks busier or louder than the references, pull back.
