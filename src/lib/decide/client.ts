import { TASKS, type TaskName } from "./tasks";
import type { DecideResult } from "./types";

/**
 * Browser side of the decision layer. Talks only to our own /api/decide
 * route (the TypeSafe key never leaves the server). If the route is
 * unreachable or slow, the same task registry answers locally, so the UI
 * always gets a decision.
 */
const CLIENT_TIMEOUT_MS = 2500;
const BATCH = 16;

export interface DecideItem {
  id: string;
  input: unknown;
}

function localAll(task: TaskName, items: DecideItem[], why: string): DecideResult[] {
  const t = TASKS[task] as unknown as { parse(r: unknown): unknown; local(i: unknown): DecideResult["answers"] };
  return items.flatMap((it) => {
    const parsed = t.parse(it.input);
    return parsed === null ? [] : [{ id: it.id, source: "local" as const, answers: t.local(parsed), model: "local-heuristic", ms: 0, fallback: why }];
  });
}

async function post(task: TaskName, items: DecideItem[]): Promise<DecideResult[]> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), CLIENT_TIMEOUT_MS);
  try {
    const res = await fetch("/api/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, items }),
      signal: ctl.signal,
    });
    if (!res.ok) return localAll(task, items, `route http ${res.status}`);
    const { results } = (await res.json()) as { results: DecideResult[] };
    const got = new Set(results.map((r) => r.id));
    const missing = items.filter((it) => !got.has(it.id));
    return missing.length ? [...results, ...localAll(task, missing, "route skipped item")] : results;
  } catch {
    return localAll(task, items, ctl.signal.aborted ? "route timeout" : "route unreachable");
  } finally {
    clearTimeout(timer);
  }
}

/** Decide a batch of items for one task (chunks of 16, one Jev call per item server-side). */
export async function decideMany(task: TaskName, items: DecideItem[]): Promise<DecideResult[]> {
  const chunks: DecideItem[][] = [];
  for (let i = 0; i < items.length; i += BATCH) chunks.push(items.slice(i, i + BATCH));
  return (await Promise.all(chunks.map((c) => post(task, c)))).flat();
}

/** Ask whether the server has a key configured (never returns the key itself). */
export async function decideStatus(): Promise<{ jev: boolean; model: string } | null> {
  try {
    const res = await fetch("/api/decide", { cache: "no-store" });
    return res.ok ? ((await res.json()) as { jev: boolean; model: string }) : null;
  } catch {
    return null;
  }
}
