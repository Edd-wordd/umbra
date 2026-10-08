import type { UmbraAction } from "./types";

export const KNOWLEDGE_ACTIONS: UmbraAction[] = [
  {
    id: "knowledge.note.open",
    label: "Open note",
    description: "Open a note in Obsidian or the source editor.",
    domain: "knowledge",
    risk: "read",
    dryRun: (ctx) => ({ summary: "Open note", target: String(ctx.args?.entityId ?? "selected note"), expectedResult: "The note opens for review." }),
    execute: () => ({ ok: true, message: "note open prepared; Obsidian bridge comes later" }),
    approvalPolicy: "none",
  },
  {
    id: "knowledge.note.structure",
    label: "Structure note",
    description: "Prepare typed frontmatter/umbra_id for an unstructured note without writing it yet.",
    domain: "knowledge",
    risk: "prepare",
    dryRun: (ctx) => ({
      summary: "Prepare note structure",
      target: String(ctx.args?.entityId ?? "selected note"),
      expectedResult: "A typed frontmatter proposal is prepared; the note is not modified until approved.",
    }),
    execute: () => ({ ok: false, message: "knowledge.note.structure is not wired to note writing yet" }),
  },
  {
    id: "knowledge.note.write",
    label: "Write note",
    description: "Write an approved note change.",
    domain: "knowledge",
    risk: "destructive",
    dryRun: (ctx) => ({
      summary: "Write note change",
      target: String(ctx.args?.entityId ?? "selected note"),
      expectedResult: "The note file is modified on disk.",
      rollbackHint: "Use git/backup/history to restore previous content if needed.",
      warnings: ["Requires explicit approval and diff review."],
    }),
    execute: () => ({ ok: false, message: "knowledge.note.write is not wired to filesystem bridge yet" }),
  },
];
