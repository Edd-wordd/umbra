# Umbra: lo-fi wireframes (v0, for review before any code)

Frames are 1920×1080. Each `.html` file is self-contained (inline SVG/CSS; the Google Font link is optional, and the font falls back to a locally installed JetBrains Mono or any monospace font). The PNGs are headless-Chrome renders.

| Frame | HTML | PNG |
|---|---|---|
| 01 Idle | idle.html | idle.png |
| 02 Dev rail awake | dev-rail-awake.html | dev-rail-awake.png |
| 03 Voice active + approval | voice-active.html | voice-active.png |
| 04 Astro mode (orrery) | astro-mode.html | astro-mode.png |
| 05 ⌘K palette (optional) | cmdk.html | cmdk.png |

- Gray `[n]` labels with dashed leader lines are annotations. They are not part of the UI.
- All data is labeled SAMPLE and made up.
- The mesh is a seeded force simulation in `src/build.mjs` (163 nodes / 221 links, all named after real things: repos, devices, notes, leads, sessions).
- Regenerate: `node src/build.mjs && src/render.sh`
