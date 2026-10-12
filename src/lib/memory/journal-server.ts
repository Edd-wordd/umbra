import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MemoryEvent } from "./types";

const JOURNAL_PATH = path.join(process.cwd(), ".umbra", "runtime", "events.jsonl");

export async function appendJournalEvents(events: MemoryEvent[]): Promise<void> {
  if (!events.length) return;
  await mkdir(path.dirname(JOURNAL_PATH), { recursive: true });
  const lines = events.map((event) => JSON.stringify(event)).join("\n") + "\n";
  await writeFile(JOURNAL_PATH, lines, { flag: "a" });
}

export async function readJournalEvents(limit = 50): Promise<MemoryEvent[]> {
  try {
    const text = await readFile(JOURNAL_PATH, "utf8");
    return text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as MemoryEvent)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  } catch {
    return [];
  }
}
