import type { BrainDomain, BrainRisk } from "../brain/types";

export const OBSIDIAN_NOTE_TYPES = [
  "project",
  "area",
  "resource",
  "runbook",
  "decision",
  "incident",
  "session_log",
  "device",
  "person",
  "lead",
  "service",
] as const;

export type ObsidianNoteType = (typeof OBSIDIAN_NOTE_TYPES)[number];

export interface ObsidianFrontmatter {
  type?: string;
  umbra_id?: string;
  domain?: BrainDomain | string;
  status?: string;
  created?: string;
  updated?: string;
  aliases?: string[];
  tags?: string[];
  related_projects?: string[];
  related_devices?: string[];
  related_repos?: string[];
  related_services?: string[];
  related_people?: string[];
  related_runbooks?: string[];
  related_decisions?: string[];
  affects?: string[];
  triggers?: string[];
  external_id?: string;
  risk?: BrainRisk | string;
  confidence?: number;
  live_source?: string;
}

export interface ParsedObsidianNote {
  vault: string;
  path: string;
  title: string;
  frontmatter: ObsidianFrontmatter;
  body: string;
  wikilinks: string[];
}

export interface ObsidianIndexResult {
  accepted: ParsedObsidianNote[];
  rejected: Array<{ note: ParsedObsidianNote; reason: string }>;
}
