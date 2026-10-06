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
- The brain is drawn as a **system core**, not a dot cloud. It has a central core glyph, a segmented inner ring, a hub ring, and an outer dial with ticks, split into 7 radial sectors (Dev, Lab/Net, Print, Astro, Business, Cameras, Knowledge). Each sector has one hub. Tier-1 entities sit on a bus arc and tier-2 children on an outer bus arc, joined by radial/arc pathways. Cross-domain links are grouped hub↔hub into faint inner chords.
- The layout is deterministic and comes from the same graph model in `src/build.mjs` (126 nodes / 184 links, named after real things: repos, devices, notes, leads, sessions). Only about 58 are drawn, because dense sets (notes, leads, extra devices) are capped per sector.
- Glow is shown only when something is active. Idle uses a faint grey halo that breathes on a 9s cycle. A lit sector gets a faint wedge, a lit dial arc, and lit pathways. In voice-active, a cyan halo, a pulse ring, and ripples follow the audio level.
- `voice-active.html` includes a small JS demo of the pulse. A simulated speech envelope drives one level value per frame, which sets the halo scale and opacity, the pulse-ring radius, and ripples on peaks. Add `#static` to the URL, or turn on reduced motion, to freeze it. `render.sh` uses `#static`, so the PNGs are deterministic.
- Regenerate: `node src/build.mjs && src/render.sh`

## Perf note (proposed implementation)

- **One canvas:** a single R3F/WebGL canvas for the core and orrery. No DOM/SVG nodes per element, and no extra canvases.
- **Instanced geometry:** hubs, leaves, and ticks are each one `InstancedMesh`. Rings, arcs, and pathways go into one merged line geometry, so there are only a few draw calls in total.
- **Glow:** either one bloom pass on a selective layer (only the core and lit elements), or a cheaper shader glow (radial falloff on a core quad) with no post-processing. Pick one, not both.
- **Voice pulse:** the RMS of the LiveKit TTS track, computed per frame with an `AnalyserNode`, is smoothed (fast attack, slow release) and written to **one uniform** (`uLevel`). Halo scale and intensity, ring scale, and ripple spawn all read that uniform, so no extra load or allocations.
- **Budget:** cap DPR (`dpr={[1, 1.5]}`). Throttle frames when idle (`frameloop="demand"` plus a ~10 fps breathe tick, back to full rate on touch/voice). Pause the loop when the tab is hidden.
- **Data:** the core reads the same graph model as the rails and tools. Sector, tier, and caps are derived from the graph, and the layout is computed once, not simulated every frame. The orrery morph tweens the same instances from core positions to orbit positions (~1.2s).

