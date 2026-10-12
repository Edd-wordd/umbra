import type { Runbook } from "./types";

export const KNOWLEDGE_RUNBOOKS: Runbook[] = [
  {
    id: "runbook:knowledge:structure-inbox-note",
    title: "Structure Inbox Note",
    domain: "knowledge",
    description: "Convert a loose Obsidian note into a typed graph-ready note with frontmatter and stable umbra_id.",
    triggers: ["note_untyped", "orphan_note"],
    risk: "prepare",
    steps: [
      { id: "open", title: "Open note", actionId: "knowledge.note.open" },
      { id: "classify", title: "Choose note type and domain" },
      { id: "prepare", title: "Prepare frontmatter", actionId: "knowledge.note.structure" },
      { id: "write", title: "Write after approval", actionId: "knowledge.note.write", requiresApproval: true },
    ],
    successCriteria: ["Note has known type", "Note has stable umbra_id", "Relevant semantic relationships are explicit"],
    failureModes: ["Wrong note type", "Duplicate umbra_id", "Generated content accepted without review"],
  },
];
