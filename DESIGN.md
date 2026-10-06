# Umbra — Design Constraints

> Binding rules for any future UI work. Prefer silence and restraint over spectacle.

## Product stance

- **Umbra** is an interactive personal life OS agent — not a dashboard, not a widget wall.
- Default mode is **quiet**. The UI does not perform until touch or voice invites it.

## Visual system

| Rule | Constraint |
|------|------------|
| Background | Near-black. Subtle grid only — never busy wallpaper. |
| Linework | Thin lines; zero or near-zero radius; tactical, not playful. |
| Type | Monospace for chrome / data; keep hierarchy sparse. |
| Color | Cyan / amber / red **glow only on activity**. Idle ≈ monochrome void. |
| Accents | Tron-like grid / edge highlights **sparingly**. No constant neon wash. |
| Density | Show what is needed for the active rail. Reject everything-at-once. |

## Centerpiece

- Center of the experience: a living **Obsidian-style force mesh** (the “brain”).
- In **Astro** mode the mesh **morphs into an orrery** (orbital wireframe), then back.
- Motion should feel physical and calm — force simulation, not particle fireworks.

## Layout

- Rails and strips (Dev, Homelab, Print, Astro, Business, Focus/Ops, Comms) are **secondary** to the brain.
- Prefer edge rails and thin status strips over floating panels.
- No stacked translucent HUD windows. No cluttered sci-fi chrome.

## Interaction

- Silent until **touch** or **voice** (LiveKit wake word / Agents).
- Tool calls that carry risk require **explicit approval** in the UI.
- Activity glow (cyan/amber/red) signals state changes; do not decorate idle chrome.

## Explicit rejects

- Floating panels / window salad
- Busy sci-fi wallpaper or full-bleed cityscapes
- Rainbow neon / always-on glow
- Dashboard-first information density
- Decorative motion that does not encode state

## Stack cues (visual)

- **R3F** + **react-force-graph** for mesh / orrery
- Tailwind tokens should encode the near-black + activity-only glow palette
- UI copy stays short, ops-toned, monospace-friendly

## Reference moodboard

See `references/` and `references/SOURCES.md`. New UI should be checkable against those stills: if it looks busier or louder than the references, pull back.
