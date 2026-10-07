import { BLOCKED_ON_EDWARD, type DevSignal, type SignalKind } from "../dev/signals";
import { choice, expectChoice, localChoice, localNoul, localScore, noul, noulConfidence, score } from "./questions";
import type { Answers, DecisionSource, JsonValue } from "./types";

/**
 * Needs-you triage. One Jev call per signal with five atomic questions; the
 * placement is decided here in code, so weights and thresholds can change
 * without re-asking the model.
 */

export const CATEGORY = {
  "act-now": "Needs Edward now: something is broken, an agent is blocked on him, or a person is waiting on a reply",
  today: "Needs Edward sometime today, but not right now",
  fyi: "Good to know; no action needed from Edward",
  ignore: "Routine noise Edward never needs to see",
} as const;
export type Category = keyof typeof CATEGORY;

export const URGENCY_LEVELS = [
  "Noise: routine or automated, no action is ever needed",
  "Low: worth knowing, no action needed",
  "Medium: should be handled sometime today",
  "High: should be handled within the hour",
  "Critical: broken for real users or customers, or blocking Edward's work right now",
];

export const TRIAGE_QUESTIONS = {
  needs_attention: noul("Does `event` need Edward's attention now, meaning he should look at it within the next hour?", {
    true: "He should look within the hour: something is broken, blocked on him, or a person is waiting.",
    false: "It can wait until later, is only informational, or Umbra can handle it.",
  }),
  urgency: score("How urgent is `event` for Edward, given `project`?", URGENCY_LEVELS),
  category: choice("Where does `event` belong in Edward's day?", CATEGORY),
  self_fixable: noul(
    "Can Umbra safely resolve `event` by itself with one reversible action (for example restarting a container, rerunning CI, or freeing a stale port), without Edward deciding anything?",
  ),
  affects_people: noul(
    "Does `event` affect people other than Edward right now, such as site visitors, a client, or a sales lead waiting for a reply?",
  ),
};
export type TriageQuestions = typeof TRIAGE_QUESTIONS;
export type TriageAnswers = Answers<TriageQuestions>;

/** What each project is, so "who does this affect" has context. Kept short (Jev prefers small state). */
const PROJECT_ROLE: Record<string, string> = {
  umbra: "Edward's personal ops console (this app); local only, no users",
  parallax: "Edward's astronomy targets app; personal side project, few users",
  "deadbridge-site": "live website and lead-intake form for Deadbridge, Edward's business; real visitors and customers",
  google: "small personal experiment; no users",
};

const KIND_LABEL: Record<SignalKind, string> = {
  "ci.failed": "CI run failed",
  "agent.waiting": "coding agent is paused waiting for Edward's answer",
  "agent.failed": "coding agent stopped on failing tests",
  "agent.done": "coding agent finished; diff ready for review",
  "container.restarts": "container restarted repeatedly",
  "sentry.spike": "spike of errors reported by Sentry",
  "lead.new": "new sales lead arrived",
  "unpushed.stale": "local commits not pushed to any remote",
  "posthog.spike": "traffic spike in analytics",
  "deps.update": "automated dependency update",
  "port.stale": "orphan process still holding a dev port",
  service: "a connected service flagged a problem",
};

export function triageState(s: DevSignal): JsonValue {
  return {
    edward: "Solo developer. Umbra is his personal ops console and should only interrupt him for things that need him.",
    project: s.repo ? { name: s.repo, role: PROJECT_ROLE[s.repo] ?? "one of Edward's projects" } : { name: "none", role: "machine-level, not tied to a project" },
    event: {
      what: KIND_LABEL[s.kind],
      source: s.source,
      title: s.title,
      ...(s.detail ? { detail: s.detail } : {}),
      source_severity: s.tone,
      ...(s.facts ? { facts: s.facts } : {}),
    },
  };
}

/* --- local heuristic: same answer shapes, deterministic ------------------ */

interface Base {
  attn: number;
  /** Urgency level 0..4. */
  urg: number;
  cat: Category;
  fix: number;
  people: number;
  /** How sure the heuristic is (distribution sharpness). */
  sharp?: number;
}

const BASE: Record<SignalKind, Base> = {
  "ci.failed": { attn: 0.7, urg: 3, cat: "act-now", fix: 0.35, people: 0.2 },
  "agent.waiting": { attn: 0.9, urg: 3, cat: "act-now", fix: 0.05, people: 0.05, sharp: 0.8 },
  "agent.failed": { attn: 0.75, urg: 3, cat: "act-now", fix: 0.2, people: 0.1 },
  "agent.done": { attn: 0.3, urg: 2, cat: "today", fix: 0.05, people: 0.05 },
  "container.restarts": { attn: 0.65, urg: 3, cat: "act-now", fix: 0.75, people: 0.5 },
  "sentry.spike": { attn: 0.8, urg: 4, cat: "act-now", fix: 0.1, people: 0.85, sharp: 0.75 },
  "lead.new": { attn: 0.7, urg: 3, cat: "act-now", fix: 0.05, people: 0.9 },
  "unpushed.stale": { attn: 0.25, urg: 2, cat: "today", fix: 0.4, people: 0.05 },
  "posthog.spike": { attn: 0.2, urg: 1, cat: "fyi", fix: 0.05, people: 0.3 },
  "deps.update": { attn: 0.05, urg: 0, cat: "ignore", fix: 0.6, people: 0.0, sharp: 0.8 },
  "port.stale": { attn: 0.45, urg: 2, cat: "today", fix: 0.85, people: 0.0 },
  service: { attn: 0.5, urg: 2, cat: "today", fix: 0.3, people: 0.2, sharp: 0.55 },
};

const userFacing = (s: DevSignal) => s.repo === "deadbridge-site";
const num = (s: DevSignal, k: string) => (typeof s.facts?.[k] === "number" ? (s.facts[k] as number) : 0);

export function localTriage(s: DevSignal): TriageAnswers {
  const b: Base = { ...BASE[s.kind] };
  // Severity the source reported nudges the base read.
  if (s.tone === "broken") {
    b.attn += 0.1;
    b.urg += 0.5;
  }
  if (s.tone === "info") {
    b.attn -= 0.1;
    b.urg -= 0.5;
  }
  if (s.kind === "service" && s.tone === "broken") {
    b.cat = "act-now";
    b.urg = 3;
  }
  if (s.kind === "ci.failed" && s.facts?.branch !== "main") {
    b.cat = "today";
    b.urg = 2;
    b.attn -= 0.25;
  }
  if (s.kind === "container.restarts" && num(s, "restarts") >= 3) {
    b.attn += 0.1;
    b.urg += 0.5;
  }
  if (userFacing(s) && b.people > 0.1) b.people = Math.min(1, b.people + 0.1);
  else if (!userFacing(s)) b.people *= 0.4;

  const q = TRIAGE_QUESTIONS;
  const sharp = b.sharp ?? 0.65;
  return {
    needs_attention: localNoul(b.attn),
    urgency: localScore(q.urgency, Math.max(0, Math.min(4, b.urg)), sharp),
    category: localChoice(q.category, b.cat, sharp),
    self_fixable: localNoul(s.fix ? Math.max(b.fix, 0.6) : b.fix * 0.8),
    affects_people: localNoul(b.people),
  };
}

/* --- combine in code ------------------------------------------------------ */

export type Placement = "needs-you" | "chip" | "log";

export interface TriageDecision {
  id: string;
  source: DecisionSource;
  model: string;
  placement: Placement;
  /** 0..1, sorts the Needs-you list. */
  priority: number;
  /** 1..5 (Jev's 0-indexed score + 1). */
  urgency: number;
  category: Category;
  /** Mean of the answers' confidences (Noul via |2p − 1|). */
  confidence: number;
  /** Low confidence leans toward showing; the row carries an "unsure" mark. */
  unsure: boolean;
  /** Probability Umbra can fix it alone with one action. */
  selfFix: number;
  attention: number;
  people: number;
  /** Short why, for hover: "jev · urgent 4/5 · 83%". */
  reason: string;
  /** Code rule that overrode the judgment, if any. */
  rule?: string;
  fallback?: string;
  ms: number;
}

const CAT_WEIGHT: Record<Category, number> = { "act-now": 1, today: 0.55, fyi: 0.15, ignore: 0 };

/** Tunables (change here, no re-asking). */
export const TRIAGE_POLICY = {
  weights: { attention: 0.35, urgency: 0.35, category: 0.2, people: 0.1 },
  needsYou: 0.55,
  /** Below needsYou but at least this, and unsure → still shown (lean toward showing). */
  unsureFloor: 0.35,
  unsureBelow: 0.5,
  chip: 0.22,
  /** Visible Needs-you rows before "+N more". */
  maxShown: 3,
} as const;

export function combineTriage(
  s: DevSignal,
  a: TriageAnswers,
  meta: { source: DecisionSource; model: string; ms: number; fallback?: string },
): TriageDecision {
  const P = TRIAGE_POLICY;
  const urgency = a.urgency.score + 1;
  const attention = a.needs_attention.noul;
  const people = a.affects_people.noul;
  const catE = expectChoice(a.category, CAT_WEIGHT);
  const w = P.weights;
  const priority = w.attention * attention + w.urgency * (a.urgency.score / 4) + w.category * catE + w.people * people;
  const confidence = (a.urgency.confidence + a.category.confidence + noulConfidence(a.needs_attention)) / 3;
  const unsure = confidence < P.unsureBelow;

  let placement: Placement;
  let rule: string | undefined;
  if (BLOCKED_ON_EDWARD.has(s.kind)) {
    placement = "needs-you";
    rule = "blocked on you";
  } else if (priority >= P.needsYou || (a.category.choice === "act-now" && a.category.confidence >= 0.5)) {
    placement = "needs-you";
  } else if (unsure && priority >= P.unsureFloor) {
    placement = "needs-you";
    rule = "unsure → shown";
  } else if (priority >= P.chip && s.repo && a.category.choice !== "ignore") {
    placement = "chip";
  } else {
    placement = "log";
  }

  const pct = Math.round(confidence * 100);
  const reason = `${meta.source} · urgent ${Math.round(urgency)}/5 · ${pct}%`;
  return {
    id: s.id,
    source: meta.source,
    model: meta.model,
    placement,
    priority,
    urgency,
    category: a.category.choice,
    confidence,
    unsure,
    selfFix: a.self_fixable.noul,
    attention,
    people,
    reason,
    rule,
    fallback: meta.fallback,
    ms: meta.ms,
  };
}

/** Parse untrusted JSON into a DevSignal (server route input). */
export function parseSignal(raw: unknown): DevSignal | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const kind = str(r.kind) as SignalKind | undefined;
  if (!r.id || !kind || !(kind in BASE) || !str(r.title)) return null;
  const tone = r.tone === "broken" || r.tone === "attention" || r.tone === "info" ? r.tone : "info";
  const facts: Record<string, string | number | boolean> = {};
  if (r.facts && typeof r.facts === "object")
    for (const [k, v] of Object.entries(r.facts as Record<string, unknown>).slice(0, 12))
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") facts[k.slice(0, 40)] = typeof v === "string" ? v.slice(0, 200) : v;
  const fix = r.fix && typeof r.fix === "object" ? (r.fix as DevSignal["fix"]) : undefined;
  return {
    id: String(r.id).slice(0, 120),
    at: typeof r.at === "number" ? r.at : 0,
    kind,
    source: str(r.source, 40) ?? "unknown",
    repo: str(r.repo, 60),
    title: str(r.title)!,
    detail: str(r.detail),
    tone,
    facts,
    fix: fix && typeof fix.toolId === "string" && typeof fix.label === "string" ? fix : undefined,
  };
}
