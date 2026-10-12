import { parseFrontmatter } from "./frontmatter";
import type { ParsedObsidianNote } from "./types";

export function parseObsidianNote(vault: string, path: string, markdown: string): ParsedObsidianNote {
  const { frontmatter, body } = parseFrontmatter(markdown);
  return {
    vault,
    path,
    title: titleFromMarkdown(path, body),
    frontmatter,
    body,
    wikilinks: extractWikilinks(body),
  };
}

export function extractWikilinks(markdown: string): string[] {
  const links = new Set<string>();
  const re = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown))) links.add((match[1] ?? "").trim());
  return [...links].filter(Boolean);
}

function titleFromMarkdown(path: string, body: string): string {
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.md$/i, "");
}
