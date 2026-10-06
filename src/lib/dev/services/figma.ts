import { defineService, notConnected } from "./types";

export interface FigmaPayload {
  file: string;
  editedAt: number;
  editor: string;
  openComments: number;
  frames: number;
}

export const figma = defineService<FigmaPayload>({
  id: "figma",
  label: "figma",
  chip: "figma",
  blurb: "design file, last edit, open comments",
  read(p, ctx) {
    if (!p) return notConnected("Figma");
    const age = Math.max(0, Math.round((ctx.now - p.editedAt) / 60_000));
    return {
      status: "ok",
      summary: `edited ${age}m ago`,
      rows: [
        { k: "file", v: `${p.file} · ${p.frames} frames` },
        { k: "editor", v: p.editor },
        { k: "comments", v: `${p.openComments} open`, tone: p.openComments ? undefined : "dim" },
      ],
      actions: [{ label: "open file ↗", toolId: "dev.link.open", args: { label: `figma ${p.file}` } }],
    };
  },
});
