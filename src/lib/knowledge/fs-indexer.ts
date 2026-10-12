import "server-only";

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { indexObsidianNotes } from "./indexer";
import { parseObsidianNote } from "./parse";
import type { ObsidianIndexerResult } from "./indexer";

export interface VaultIndexOptions {
  vaultPath: string;
  vaultName?: string;
  maxFiles?: number;
}

const IGNORE_DIRS = new Set([".git", ".obsidian", ".trash", "node_modules", ".DS_Store"]);

export async function indexObsidianVault(options: VaultIndexOptions): Promise<ObsidianIndexerResult> {
  const root = path.resolve(options.vaultPath);
  const vaultName = options.vaultName ?? path.basename(root);
  const files = await findMarkdownFiles(root, options.maxFiles ?? 1000);
  const notes = await Promise.all(
    files.map(async (file) => {
      const markdown = await readFile(file, "utf8");
      return parseObsidianNote(vaultName, path.relative(root, file), markdown);
    }),
  );
  return indexObsidianNotes(notes);
}

async function findMarkdownFiles(root: string, maxFiles: number): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string) {
    if (out.length >= maxFiles) return;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (out.length >= maxFiles) return;
      if (entry.name.startsWith(".") || IGNORE_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        const info = await stat(full);
        if (info.size <= 2_000_000) out.push(full);
      }
    }
  }

  await walk(root);
  return out;
}
