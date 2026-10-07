import type { Answer, JsonValue, Questions, SystemOneResponse } from "./types";

/**
 * Minimal HTTP client for TypeSafe's System One API (Jev). SERVER ONLY:
 * the API key is read by the caller from process.env and never reaches the
 * browser. Imported only by src/lib/decide/decide.ts and the route handler.
 *
 *   POST https://api.typesafe.ai/v1/systemone
 *   Authorization: Bearer <TYPESAFE_API_KEY>
 *   { state, model: "jev-latest", questions: { id: {type, instructions, criteria?} } }
 *   → { model, answers: { id: {type, noul | choice+probabilities+confidence | score+legend+probabilities+confidence} }, usage }
 */
if (typeof window !== "undefined") throw new Error("decide/jev is server-only");

export const JEV_ENDPOINT = process.env.TYPESAFE_API_URL ?? "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = process.env.TYPESAFE_MODEL ?? "jev-latest";

export class JevError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "JevError";
  }
}

export interface JevCall<Qs extends Questions> {
  apiKey: string;
  state: JsonValue;
  questions: Qs;
  model?: string;
  /** Abort after this long (default 1500 ms); the caller falls back to the local heuristic. */
  timeoutMs?: number;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function validAnswer(q: Questions[string], a: unknown): a is Answer {
  if (!a || typeof a !== "object") return false;
  const x = a as Record<string, unknown>;
  if (x.type !== q.type) return false;
  if (q.type === "noul") return isNum(x.noul);
  if (!isNum(x.confidence) || !x.probabilities || typeof x.probabilities !== "object") return false;
  if (q.type === "choice") return typeof x.choice === "string" && x.choice in q.criteria;
  return isNum(x.score);
}

export async function callJev<Qs extends Questions>({ apiKey, state, questions, model = JEV_MODEL, timeoutMs = 1500 }: JevCall<Qs>): Promise<SystemOneResponse<Qs>> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(JEV_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ state, model, questions }),
      signal: ctl.signal,
      cache: "no-store",
    });
  } catch (e) {
    throw new JevError(ctl.signal.aborted ? `timeout ${timeoutMs}ms` : `network: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { detail?: { message?: string } | string };
      detail = typeof body.detail === "string" ? body.detail : (body.detail?.message ?? "");
    } catch {
      /* non-JSON error body */
    }
    throw new JevError(`http ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
  }
  const body = (await res.json()) as Partial<SystemOneResponse<Qs>>;
  const answers = body.answers as Record<string, unknown> | undefined;
  if (!answers) throw new JevError("malformed response: no answers");
  for (const [id, q] of Object.entries(questions)) {
    if (!validAnswer(q, answers[id])) throw new JevError(`malformed answer for "${id}"`);
  }
  return { model: body.model ?? model, answers: body.answers as SystemOneResponse<Qs>["answers"], usage: body.usage };
}
