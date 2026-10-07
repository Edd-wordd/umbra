/**
 * Typed shapes for TypeSafe's System One API (model: Jev).
 * Docs: https://docs.typesafe.ai/api (POST /v1/systemone).
 *
 * Shared by the server client (jev.ts) and the browser (no secrets here).
 * A request is one `state` plus a map of named questions; every question is
 * evaluated independently and in parallel, and its answer comes back under
 * the same key.
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/** Instructions may be a plain string or structured data with the question in one field. */
export type Instructions = string | { [k: string]: JsonValue } | JsonValue[];

/** Yes/no: answer is the probability of yes (0..1). No separate confidence. */
export interface NoulQuestion {
  type: "noul";
  instructions: Instructions;
  criteria?: { true?: string; false?: string };
}

/** Pick one option from a set (max 255). */
export interface ChoiceQuestion<O extends string = string> {
  type: "choice";
  instructions: Instructions;
  criteria: Record<O, string | null>;
}

/** Rate along ordered levels (2–10). Levels are indexed from 0. */
export interface ScoreQuestion {
  type: "score";
  instructions: Instructions;
  criteria: string[];
}

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;
export type Questions = Record<string, Question>;

export interface NoulAnswer {
  type: "noul";
  noul: number;
}

export interface ChoiceAnswer<O extends string = string> {
  type: "choice";
  choice: O;
  probabilities: Record<O, number>;
  confidence: number;
}

export interface ScoreAnswer {
  type: "score";
  /** Probability-weighted level, 0..levels-1; can land between levels. */
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
}

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export type AnswerFor<Q> = Q extends NoulQuestion
  ? NoulAnswer
  : Q extends ChoiceQuestion<infer O>
    ? ChoiceAnswer<O>
    : Q extends ScoreQuestion
      ? ScoreAnswer
      : never;

export type Answers<Qs extends Questions> = { [K in keyof Qs]: AnswerFor<Qs[K]> };

export interface SystemOneRequest<Qs extends Questions = Questions> {
  state: JsonValue;
  model: string;
  questions: Qs;
}

export interface SystemOneResponse<Qs extends Questions = Questions> {
  model: string;
  answers: Answers<Qs>;
  usage?: { input_tokens: number; output_tokens: number };
}

/** Where an answer came from: the Jev API, or the deterministic local heuristic. */
export type DecisionSource = "jev" | "local";

/** One decision as returned by /api/decide (and by the browser-side local fallback). */
export interface DecideResult<Qs extends Questions = Questions> {
  id: string;
  source: DecisionSource;
  answers: Answers<Qs>;
  /** Model that answered (e.g. "jev-1.13.0"), or "local-heuristic". */
  model: string;
  ms: number;
  /** Why the local fallback was used (no key, timeout, HTTP status…). */
  fallback?: string;
}
