"use client";

import { DOMAIN_LABEL, polar, sampleTiles, TILE_R, type DomainId, type TileLayout } from "@/lib/graph";
import type { Attention } from "@/lib/store";
import { getRail } from "@/lib/rails";
import { activity, color } from "@/lib/theme/tokens";
import { statusHex } from "./geometry";

/**
 * Text for the core, drawn as one SVG overlay in the same 1920x1080 frame as
 * the canvas: district codes inside the hub tiles, spaced key/value labels
 * at the rim (DEV  12/18), and leader-lined labels for the awake district's
 * featured tiles. Text stays in the DOM: crisp, cheap, no WebGL font atlas.
 */
export default function CoreLabels({
  layout = sampleTiles,
  litDomain,
  attention = {},
  hidden = false,
}: {
  layout?: TileLayout;
  litDomain: DomainId | null;
  /** Districts needing Edward: rim label turns amber/red with a short note. */
  attention?: Partial<Record<DomainId, Attention>>;
  /** Hide all text (Dev focus parks a shrunken core beside the workspace). */
  hidden?: boolean;
}) {
  const lit = litDomain ? layout.districts.find((d) => d.domain === litDomain) ?? null : null;
  const f = (v: number) => v.toFixed(1);

  const columns: { key: string; points: string; x: number; y: number; text: string; fill: string; anchor: "start" | "end" }[] = [];
  if (lit) {
    const want = layout.tiles.filter((t) => t.sector === lit.index && t.node?.featured && t.kind !== 0);
    // Labels only on the side away from the awake rail's panel (the panel
    // covers the other side and already lists the same things).
    const side = getRail(lit.domain).side === "right" ? -1 : 1;
    {
      const colX = side * (TILE_R.outer + 70);
      const items = want
        .filter((t) => (t.x < 0 ? -1 : 1) === side)
        .map((t) => ({ t, ly: t.y }))
        .sort((p, q) => p.ly - q.ly);
      let last = -1e9;
      for (const it of items) {
        it.ly = Math.max(it.t.y, last + 15);
        last = it.ly;
      }
      for (const { t, ly } of items) {
        const ex = t.x + side * (t.w / 2 + 3);
        const kx = side * (TILE_R.outer + 26);
        columns.push({
          key: t.id,
          points: `${f(ex)},${f(t.y)} ${f(kx)},${f(t.y)} ${f(kx + side * 10)},${f(ly)} ${f(colX - side * 6)},${f(ly)}`,
          x: colX,
          y: ly + 3,
          text: t.node!.label.toUpperCase(),
          fill: t.status === "attention" || t.status === "broken" ? statusHex(t.status) : color.white,
          anchor: side < 0 ? "end" : "start",
        });
      }
    }
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox="-960 -540 1920 1080"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      style={{ fontFamily: "var(--font-mono)", opacity: hidden ? 0 : 1, transition: "opacity 250ms" }}
    >
      {layout.districts.map((d) => {
        const isLit = lit?.domain === d.domain;
        const attn = attention[d.domain];
        const tone = attn ? (attn.level === "broken" ? activity.broken : activity.attention) : null;
        const [x, y] = polar(d.outer + 20, d.angle);
        const ca = Math.cos(d.angle);
        const sa = Math.sin(d.angle);
        const anchor = Math.abs(ca) < 0.25 ? "middle" : ca > 0 ? "start" : "end";
        const below = sa > 0.25;
        const yy = y + (below ? 8 : sa < -0.25 ? -4 : 3);
        return (
          <g key={d.domain} data-sector-label={d.domain}>
            {/* District code inside its hub tile. */}
            <text
              x={f(d.hub.x)}
              y={f(d.hub.y + 2.8)}
              fontSize={7.5}
              letterSpacing={1.4}
              textAnchor="middle"
              fill={isLit ? color.white : color.mid}
              opacity={isLit ? 1 : 0.8}
              style={{ transition: "opacity 300ms, fill 300ms" }}
            >
              {d.code}
            </text>
            <g opacity={isLit ? 0 : 1} style={{ transition: "opacity 300ms" }}>
              <text x={f(x)} y={f(yy)} fontSize={8.5} letterSpacing={2.6} textAnchor={anchor} fill={tone ?? color.mid} opacity={tone ? 0.95 : 0.7}>
                {DOMAIN_LABEL[d.domain]}
              </text>
              <text
                x={f(x)}
                y={f(below ? yy + 12 : yy - 12)}
                fontSize={7.5}
                letterSpacing={1.8}
                textAnchor={anchor}
                fill={tone ?? color.dim}
                opacity={tone ? 0.75 : 0.65}
              >
                {attn ? attn.note.toUpperCase() : `${String(d.shown).padStart(2, "0")}/${String(d.total).padStart(2, "0")}`}
              </text>
            </g>
          </g>
        );
      })}
      {lit && (
        <g key={lit.domain} className="umbra-fade-in">
          {(() => {
            const [x, y] = polar(lit.outer + 20, lit.angle);
            const ca = Math.cos(lit.angle);
            const anchor = Math.abs(ca) < 0.25 ? "middle" : ca > 0 ? "start" : "end";
            const yy = y + (Math.sin(lit.angle) > 0.25 ? 8 : -2);
            return (
              <text x={f(x)} y={f(yy)} fontSize={9} letterSpacing={3} textAnchor={anchor} fill={color.white}>
                {DOMAIN_LABEL[lit.domain]}
              </text>
            );
          })()}
          {columns.map((c) => (
            <g key={c.key}>
              <polyline points={c.points} fill="none" stroke={c.fill} strokeWidth={0.6} opacity={0.4} />
              <rect x={f(c.anchor === "end" ? c.x + 2 : c.x - 5)} y={f(c.y - 5.5)} width={3} height={3} fill={c.fill} opacity={0.9} />
              <text x={f(c.anchor === "end" ? c.x - 3 : c.x + 3)} y={f(c.y)} fontSize={8} letterSpacing={1.6} fill={c.fill} opacity={0.92} textAnchor={c.anchor}>
                {c.text}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
