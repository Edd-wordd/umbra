export type KnowledgeNoteKind = "session" | "decision" | "runbook";

export function sanitizeNoteTitle(input: string | undefined, fallback: string): string {
  const raw = (input ?? "").trim() || fallback;
  return raw
    .replace(/\b(create|draft|log|note|decision|session|runbook|procedure)\b/gi, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ")
    .slice(0, 80) || fallback;
}

export function buildKnowledgeNotePath(kind: KnowledgeNoteKind, titleInput?: string, now = new Date()) {
  const yyyyMmDd = now.toISOString().slice(0, 10);
  const title = sanitizeNoteTitle(titleInput, kind === "session" ? "Umbra Session" : kind === "decision" ? "Decision" : "Runbook");
  if (kind === "decision") return { relativePath: `50_Decisions/${yyyyMmDd} ${title}.md`, title, yyyyMmDd };
  if (kind === "runbook") return { relativePath: `40_Runbooks/Inbox/${yyyyMmDd} ${title}.md`, title, yyyyMmDd };
  return { relativePath: `60_Logs/Sessions/${yyyyMmDd} ${title}.md`, title, yyyyMmDd };
}

export function buildKnowledgeNotePreview(kind: KnowledgeNoteKind, titleInput?: string) {
  const note = buildKnowledgeNotePath(kind, titleInput);
  const type = kind === "session" ? "session" : kind === "decision" ? "decision" : "runbook";
  const firstSection = kind === "session" ? "## Summary" : kind === "decision" ? "## Decision" : "## Purpose";
  return [`---`, `type: ${type}`, `umbra_id: ${type}:${note.yyyyMmDd}:umbra`, `domain: knowledge`, `status: draft`, `---`, `# ${note.title}`, ``, firstSection, ``, `- `].join("\n");
}
