import type { ChoiceAnswer, ChoiceQuestion, Instructions, NoulAnswer, NoulQuestion, ScoreAnswer, ScoreQuestion } from "./types";

/**
 * Question builders + answer helpers. Keep questions atomic (one judgment
 * each) and combine answers in code; the docs' "composite scoring" and
 * "confidence-gated routing" patterns.
 */

export const noul = (instructions: Instructions, criteria?: { true?: string; false?: string }): NoulQuestion =>
  criteria ? { type: "noul", instructions, criteria } : { type: "noul", instructions };

/** Option keys keep their literal types, so `answer.choice` is a typed union. */
export const choice = <const O extends string>(instructions: Instructions, criteria: Record<O, string | null>): ChoiceQuestion<O> => ({
  type: "choice",
  instructions,
  criteria,
});

export const score = (instructions: Instructions, levels: string[]): ScoreQuestion => {
  if (levels.length < 2 || levels.length > 10) throw new Error("score needs 2–10 levels");
  return { type: "score", instructions, criteria: levels };
};

/* --- confidence (formulas from docs.typesafe.ai/confidence) -------------- */

/** Noul has no confidence field; |2p − 1| puts it on the Choice scale. */
export const noulConfidence = (a: NoulAnswer) => Math.abs(2 * a.noul - 1);

export function choiceConfidence(probabilities: number[]): number {
  const n = probabilities.length;
  if (n < 2) return 1;
  return Math.max(0, Math.min(1, (Math.max(...probabilities) - 1 / n) / (1 - 1 / n)));
}

export function scoreConfidence(probabilities: number[]): number {
  const n = probabilities.length;
  if (n < 2) return 1;
  const m = probabilities.indexOf(Math.max(...probabilities));
  const spread = probabilities.reduce((s, p, i) => s + p * Math.abs(i - m), 0);
  const even = probabilities.reduce((s, _, i) => s + Math.abs(i - (n - 1) / 2), 0) / n;
  return Math.max(0, 1 - spread / even);
}

/* --- synthetic answers (local heuristic) --------------------------------- */

/** A peaked distribution over n levels: `sharp` on `at`, the rest falling off with distance. */
export function peaked(n: number, at: number, sharp = 0.7): number[] {
  const i0 = Math.max(0, Math.min(n - 1, Math.round(at)));
  const rest = Array.from({ length: n }, (_, i) => (i === i0 ? 0 : 1 / (1 + Math.abs(i - i0)) ** 2));
  const sum = rest.reduce((a, b) => a + b, 0) || 1;
  return rest.map((w, i) => (i === i0 ? sharp : ((1 - sharp) * w) / sum));
}

export const localNoul = (p: number): NoulAnswer => ({ type: "noul", noul: Math.max(0, Math.min(1, p)) });

export function localScore(q: ScoreQuestion, level: number, sharp = 0.7): ScoreAnswer {
  const probs = peaked(q.criteria.length, level, sharp);
  return {
    type: "score",
    score: probs.reduce((s, p, i) => s + p * i, 0),
    legend: Object.fromEntries(q.criteria.map((c, i) => [String(i), c])),
    probabilities: Object.fromEntries(probs.map((p, i) => [String(i), p])),
    confidence: scoreConfidence(probs),
  };
}

export function localChoice<O extends string>(q: ChoiceQuestion<O>, pick: O, sharp = 0.7): ChoiceAnswer<O> {
  const opts = Object.keys(q.criteria) as O[];
  const other = opts.length > 1 ? (1 - sharp) / (opts.length - 1) : 0;
  const probabilities = Object.fromEntries(opts.map((o) => [o, o === pick ? sharp : other])) as Record<O, number>;
  return { type: "choice", choice: pick, probabilities, confidence: choiceConfidence(Object.values<number>(probabilities)) };
}

/** Expected value of `weights` under a Choice distribution (less brittle than the argmax alone). */
export function expectChoice<O extends string>(a: ChoiceAnswer<O>, weights: Record<O, number>): number {
  return (Object.keys(weights) as O[]).reduce((s, o) => s + (a.probabilities[o] ?? 0) * weights[o], 0);
}
