import { noteId } from "../brain/ids";
import type { BrainDomain, BrainEdge, BrainEdgeType, BrainGraph, BrainNode, BrainNodeType } from "../brain/types";
import { isKnownNoteType } from "./frontmatter";
import type { ParsedObsidianNote } from "./types";

const TYPE_TO_NODE: Record<string, BrainNodeType> = {
  project: "project",
  area: "note",
  resource: "note",
  runbook: "runbook",
  decision: "decision",
  incident: "incident",
  session_log: "note",
  device: "device",
  person: "person",
  lead: "lead",
  service: "service",
};

export function obsidianNotesToGraph(notes: readonly ParsedObsidianNote[], now = Date.now()): BrainGraph {
  const accepted = notes.filter((note) => isTrustedGraphNote(note));
  const nodes = accepted.map((note) => noteToNode(note, now));
  const edges = accepted.flatMap((note) => noteToEdges(note, now));
  return { nodes, edges };
}

export function isTrustedGraphNote(note: ParsedObsidianNote): boolean {
  return isKnownNoteType(note.frontmatter.type) && !!note.frontmatter.umbra_id;
}

function noteToNode(note: ParsedObsidianNote, now: number): BrainNode {
  const type = TYPE_TO_NODE[note.frontmatter.type ?? "resource"] ?? "note";
  return {
    id: note.frontmatter.umbra_id ?? noteId(note.vault, note.path),
    type,
    label: note.title,
    domain: domain(note.frontmatter.domain),
    status: "silent",
    source: "obsidian",
    updatedAt: now,
    meta: {
      note: noteId(note.vault, note.path),
      path: note.path,
      status: note.frontmatter.status,
      external_id: note.frontmatter.external_id,
    },
  };
}

function noteToEdges(note: ParsedObsidianNote, now: number): BrainEdge[] {
  const from = note.frontmatter.umbra_id ?? noteId(note.vault, note.path);
  const edges: BrainEdge[] = [];
  addRelationshipEdges(edges, from, "related_projects", note.frontmatter.related_projects, "related_to", now);
  addRelationshipEdges(edges, from, "related_devices", note.frontmatter.related_devices, "documents", now);
  addRelationshipEdges(edges, from, "related_repos", note.frontmatter.related_repos, "documents", now);
  addRelationshipEdges(edges, from, "related_services", note.frontmatter.related_services, "uses", now);
  addRelationshipEdges(edges, from, "related_people", note.frontmatter.related_people, "related_to", now);
  addRelationshipEdges(edges, from, "related_runbooks", note.frontmatter.related_runbooks, "uses", now);
  addRelationshipEdges(edges, from, "related_decisions", note.frontmatter.related_decisions, "documents", now);
  addRelationshipEdges(edges, from, "affects", note.frontmatter.affects, "affects", now);

  for (const link of note.wikilinks) {
    edges.push({ from, to: `wikilink:${link}`, type: "related_to", label: "weak wikilink", source: "obsidian", updatedAt: now });
  }
  return edges;
}

function addRelationshipEdges(edges: BrainEdge[], from: string, field: string, values: string[] | undefined, type: BrainEdgeType, now: number) {
  for (const to of values ?? []) edges.push({ from, to, type, label: field, source: "obsidian", updatedAt: now });
}

function domain(value: string | undefined): BrainDomain {
  if (value === "dev" || value === "lab" || value === "print" || value === "astro" || value === "business" || value === "cameras" || value === "knowledge" || value === "ops") return value;
  return "knowledge";
}
