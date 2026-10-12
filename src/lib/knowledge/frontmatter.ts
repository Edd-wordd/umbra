import { OBSIDIAN_NOTE_TYPES, type ObsidianFrontmatter, type ObsidianNoteType } from "./types";

export function isKnownNoteType(value: string | undefined): value is ObsidianNoteType {
  return !!value && (OBSIDIAN_NOTE_TYPES as readonly string[]).includes(value);
}

export function parseFrontmatter(markdown: string): { frontmatter: ObsidianFrontmatter; body: string } {
  if (!markdown.startsWith("---\n")) return { frontmatter: {}, body: markdown };
  const end = markdown.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: {}, body: markdown };
  const raw = markdown.slice(4, end).trim();
  const body = markdown.slice(end + 4).replace(/^\n/, "");
  return { frontmatter: parseSimpleYaml(raw), body };
}

function parseSimpleYaml(raw: string): ObsidianFrontmatter {
  const out: Record<string, unknown> = {};
  const lines = raw.split(/\r?\n/);
  let currentListKey: string | undefined;

  for (const line of lines) {
    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && currentListKey) {
      const list = Array.isArray(out[currentListKey]) ? out[currentListKey] as string[] : [];
      list.push(cleanScalar(listItem[1] ?? ""));
      out[currentListKey] = list;
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2] ?? "";
    if (!value) {
      out[key] = [];
      currentListKey = key;
      continue;
    }
    currentListKey = undefined;
    out[key] = parseScalarOrInlineList(value);
  }

  return out as ObsidianFrontmatter;
}

function parseScalarOrInlineList(value: string): string | string[] | number {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map(cleanScalar);
  }
  const num = Number(trimmed);
  if (trimmed && !Number.isNaN(num) && /^\d+(\.\d+)?$/.test(trimmed)) return num;
  return cleanScalar(trimmed);
}

function cleanScalar(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}
