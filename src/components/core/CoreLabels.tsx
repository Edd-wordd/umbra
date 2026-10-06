"use client";

import { polar, RADII, sampleLayout, type CoreLayout, type DomainId } from "@/lib/graph";
import type { Attention } from "@/lib/store";
import { activity, color } from "@/lib/theme/tokens";
import { statusHex } from "./geometry";

/**
 * Text for the core (rim sector names + labels for the awake sector), drawn
 * as one SVG overlay in the same 1920x1080 frame as the canvas. Text stays in
 * the DOM: crisp, cheap, selectable, no WebGL font atlas.
 */
export default function CoreLabels({
  layout = sampleLayout,
  litDomain,
  attention = {},
  hidden = false,
}: {
  layout?: CoreLayout;
  litDomain: DomainId | null;
  /** Sectors needing Edward: rim label turns amber/red with a short count line. */
  attention?: Partial<Record<DomainId, Attention>>;
  /** Hide all text (Dev focus parks a shrunken core beside the workspace). */
  hidden?: boolean;
}) {
  const lit = litDomain ? layout.sectors[layout.sectorIndex[litDomain]] : null;

  const columns: { key: string; points: string; x: number; y: number; text: string; fill: string; anchor: "start" | "end" }[] = [];
  if (lit) {
    const want = [...lit.t1, ...lit.t2]
      .map((id) => layout.nodes.get(id)!)
      .filter((n) => n.node.featured);
    for (const side of [-1, 1] as const) {
      const items = want
        .filter((n) => (Math.cos(n.angle) < 0.02 ? -1 : 1) === side)
        .map((n) => {
          const [ox, oy] = polar(RADII.dial + 12, n.angle);
          return { n, ox, oy, ly: 0 };
        })
        .sort((p, q) => p.oy - q.oy);
      let last = -1e9;
      for (const it of items) {
        it.ly = Math.max(it.oy, last + 15);
        last = it.ly;
      }
      const colX = side < 0 ? -RADII.dial - 40 : RADII.dial + 40;
      for (const { n, ox, oy, ly } of items) {
        const f = (v: number) => v.toFixed(1);
        columns.push({
          key: n.id,
          points: `${f(n.x)},${f(n.y)} ${f(ox)},${f(oy)} ${f(ox + side * 6)},${f(ly)} ${f(colX - side * 4)},${f(ly)}`,
          x: colX,
          y: ly + 3.5,
          text: n.node.label,
          fill: statusHex(n.node.status),
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
      {layout.sectors.map((s) => {
        const [x, y] = polar(RADII.label, s.angle);
        const ca = Math.cos(s.angle);
        const anchor = Math.abs(ca) < 0.2 ? "middle" : ca > 0 ? "start" : "end";
        const yy = y + 3.5 + (Math.sin(s.angle) > 0.9 ? 6 : 0);
        const isLit = lit?.domain === s.domain;
        const attn = attention[s.domain];
        const fill = attn ? (attn.level === "broken" ? activity.broken : activity.attention) : color.dim;
        return (
          <g key={s.domain} data-sector-label={s.domain}>
            <text
              x={x.toFixed(1)}
              y={yy.toFixed(1)}
              fontSize={9.5}
              letterSpacing={2}
              textAnchor={anchor}
              fill={fill}
              opacity={isLit ? 0 : attn ? 0.85 : 0.55}
              style={{ transition: "opacity 300ms, fill 300ms" }}
            >
              {s.label}
            </text>
            {attn && !isLit && (
              <text
                className="umbra-fade-in"
                x={x.toFixed(1)}
                y={(Math.sin(s.angle) < 0 ? yy - 14 : yy + 14).toFixed(1)}
                fontSize={8.5}
                letterSpacing={0.5}
                textAnchor={anchor}
                fill={fill}
                opacity={0.6}
              >
                {attn.note}
              </text>
            )}
          </g>
        );
      })}
      <g key={lit?.domain ?? "none"} className="umbra-fade-in">
        {columns.map((c) => (
          <g key={c.key}>
            <polyline points={c.points} fill="none" stroke={c.fill} strokeWidth={0.8} opacity={0.35} />
            <text x={c.x.toFixed(1)} y={c.y.toFixed(1)} fontSize={10} fill={c.fill} opacity={0.9} textAnchor={c.anchor}>
              {c.text}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
