import { buildKnowledgeNotePath, buildKnowledgeNotePreview } from "../knowledge/note-templates";
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
    id: "knowledge.decision.create",
    label: "Create decision note",
    description: "Create a new approved Umbra decision note in the Obsidian vault.",
    domain: "knowledge",
    risk: "local-risky",
    dryRun: (ctx) => {
      const title = String(ctx.args?.title ?? "");
      const note = buildKnowledgeNotePath("decision", title);
      return {
        summary: "Create Obsidian decision note",
        target: note.relativePath,
        expectedResult: "A new markdown decision note is created in the vault. Existing files are never overwritten.",
        warnings: ["Writes a new file to the configured Obsidian vault."],
        preview: buildKnowledgeNotePreview("decision", title),
      };
    },
    execute: () => ({ ok: false, message: "knowledge.decision.create must execute through the server vault writer" }),
  },
  {
    id: "knowledge.session.create",
    label: "Create session note",
    description: "Create a new approved Umbra session note in the Obsidian vault.",
    domain: "knowledge",
    risk: "local-risky",
    dryRun: (ctx) => {
      const title = String(ctx.args?.title ?? "");
      const note = buildKnowledgeNotePath("session", title);
      return {
        summary: "Create Obsidian session note",
        target: note.relativePath,
        expectedResult: "A new markdown session note is created in the vault. Existing files are never overwritten.",
        warnings: ["Writes a new file to the configured Obsidian vault."],
        preview: buildKnowledgeNotePreview("session", title),
      };
    },
    execute: () => ({ ok: false, message: "knowledge.session.create must execute through the server vault writer" }),
  },
  {
    id: "knowledge.runbook.create",
    label: "Create runbook note",
    description: "Create a new approved Umbra runbook stub in the Obsidian vault.",
    domain: "knowledge",
    risk: "local-risky",
    dryRun: (ctx) => {
      const title = String(ctx.args?.title ?? "");
      const note = buildKnowledgeNotePath("runbook", title);
      return {
        summary: "Create Obsidian runbook note",
        target: note.relativePath,
        expectedResult: "A new markdown runbook note is created in the vault. Existing files are never overwritten.",
        warnings: ["Writes a new file to the configured Obsidian vault."],
        preview: buildKnowledgeNotePreview("runbook", title),
      };
    },
    execute: () => ({ ok: false, message: "knowledge.runbook.create must execute through the server vault writer" }),
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
