import { callJev, JevError } from "./jev";
import { TASKS, type TaskName } from "./tasks";
import type { DecideResult, Questions } from "./types";

/**
 * Server-side decide(): ask Jev when TYPESAFE_API_KEY is set, otherwise (or
 * on error / timeout) answer with the task's deterministic local heuristic.
 * Results always carry `source: "jev" | "local"`. Jev results are cached by
 * exact request (state + questions) for 10 minutes.
 */
if (typeof window !== "undefined") throw new Error("decide/decide is server-only");

const TTL = 10 * 60_000;
const MAX_CACHE = 400;
const cache = new Map<string, { at: number; result: Omit<DecideResult, "id"> }>();

export const jevConfigured = () => !!process.env.TYPESAFE_API_KEY;

export async function decide(task: TaskName, id: string, input: unknown, opts: { timeoutMs?: number } = {}): Promise<DecideResult | null> {
  const t = TASKS[task] as unknown as { parse(r: unknown): unknown; build(i: unknown): { state: never; questions: Questions }; local(i: unknown): DecideResult["answers"] };
  const parsed = t.parse(input);
  if (parsed === null) return null;
  const { state, questions } = t.build(parsed);
  const t0 = Date.now();
  const key = process.env.TYPESAFE_API_KEY;
  let fallback = "no TYPESAFE_API_KEY";

  if (key) {
    const ck = `${task}:${JSON.stringify(state)}`;
    const hit = cache.get(ck);
    if (hit && Date.now() - hit.at < TTL) return { id, ...hit.result, ms: 0 };
    try {
      const r = await callJev({ apiKey: key, state, questions, timeoutMs: opts.timeoutMs ?? 1500 });
      const result = { source: "jev" as const, answers: r.answers, model: r.model, ms: Date.now() - t0 };
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
      cache.set(ck, { at: Date.now(), result });
      return { id, ...result };
    } catch (e) {
      fallback = e instanceof JevError ? e.message : `error: ${(e as Error).message}`;
    }
  }
  return { id, source: "local", answers: t.local(parsed), model: "local-heuristic", ms: Date.now() - t0, fallback };
}
