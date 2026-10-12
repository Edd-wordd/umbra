import { indexObsidianNotes, parseObsidianNote } from "../knowledge";
import type { BrainGraph } from "../brain/types";
import type { Situation } from "../situations/types";
import type { DomainAdapter } from "./types";

export interface KnowledgeSnapshot {
  vault: string;
  files: Array<{ path: string; markdown: string }>;
}

export const KNOWLEDGE_DOMAIN_ADAPTER: DomainAdapter<KnowledgeSnapshot> = {
  id: "knowledge",
  label: "Knowledge",
  toGraph: (snapshot, now) => indexObsidianNotes(snapshot.files.map((file) => parseObsidianNote(snapshot.vault, file.path, file.markdown)), now).graph,
  deriveSituations: deriveKnowledgeSituations,
};

export function createSampleKnowledgeSnapshot(): KnowledgeSnapshot {
  return {
    vault: "umbra",
    files: [
      {
        path: "10_Projects/Umbra.md",
        markdown: `---
type: project
umbra_id: project:umbra
domain: dev
status: active
related_runbooks:
  - runbook:dev:stale-port
---
# Umbra

Operational brain project.
`,
      },
      {
        path: "00_Inbox/Random idea.md",
        markdown: "# Random idea\n\nThis should be structured before it becomes graph memory.",
      },
    ],
  };
}

function deriveKnowledgeSituations(_graph: BrainGraph, snapshot: KnowledgeSnapshot, now: number): Situation[] {
  return snapshot.files.flatMap((file) => {
    const parsed = parseObsidianNote(snapshot.vault, file.path, file.markdown);
    if (parsed.frontmatter.type && parsed.frontmatter.umbra_id) return [];
    return [
      {
        id: `situation:knowledge:note_untyped:${file.path}`,
        type: "note_untyped",
        title: `${file.path} needs structure`,
        status: "active",
        severity: "watch",
        confidence: 0.9,
        entities: [`note:obsidian:${snapshot.vault}:${file.path}`],
        signals: [],
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
        summary: "loose note missing type or umbra_id",
        whyNow: "note is in the vault but cannot become trusted graph memory until typed",
        suggestedActions: [
          { id: "knowledge.note.open", label: "Open note", risk: "read" },
          { id: "knowledge.note.structure", label: "Structure note", risk: "prepare" },
        ],
        needsHuman: false,
      },
    ];
  });
}
