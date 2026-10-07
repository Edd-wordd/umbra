import { noteId } from "../brain/ids";
import type { BrainGraph } from "../brain/types";
import { createMemoryEvent } from "../memory";
import type { MemoryEvent } from "../memory/types";
import { isKnownNoteType } from "./frontmatter";
import { obsidianNotesToGraph } from "./to-graph";
import type { ObsidianIndexResult, ParsedObsidianNote } from "./types";

export interface ObsidianIndexerResult extends ObsidianIndexResult {
  graph: BrainGraph;
  memory: MemoryEvent[];
}

export function indexObsidianNotes(notes: readonly ParsedObsidianNote[], now = Date.now()): ObsidianIndexerResult {
  const accepted: ParsedObsidianNote[] = [];
  const rejected: ObsidianIndexResult["rejected"] = [];

  for (const note of notes) {
    const reason = rejectionReason(note);
    if (reason) rejected.push({ note, reason });
    else accepted.push(note);
  }

  const graph = obsidianNotesToGraph(accepted, now);
  const memory = [
    ...accepted.map((note) =>
      createMemoryEvent({
        source: "system",
        actor: "umbra",
        type: "note.indexed",
        summary: `indexed note · ${note.title}`,
        result: "ok",
        entities: [note.frontmatter.umbra_id ?? noteId(note.vault, note.path)],
        raw: { path: note.path, type: note.frontmatter.type },
        at: now,
      }),
    ),
    ...rejected.map(({ note, reason }) =>
      createMemoryEvent({
        source: "system",
        actor: "umbra",
        type: "note.indexed",
        summary: `skipped note · ${note.title} · ${reason}`,
        result: "info",
        entities: [noteId(note.vault, note.path)],
        raw: { path: note.path, reason },
        at: now,
      }),
    ),
  ];

  return { accepted, rejected, graph, memory };
}

function rejectionReason(note: ParsedObsidianNote): string | undefined {
  if (!note.frontmatter.type) return "missing type";
  if (!isKnownNoteType(note.frontmatter.type)) return `unknown type ${note.frontmatter.type}`;
  if (!note.frontmatter.umbra_id) return "missing umbra_id";
  return undefined;
}
