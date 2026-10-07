import { classifyCommand } from "../dev/risk";
import type { DevSignal } from "../dev/signals";
import { localNoul, noul } from "./questions";
import { localTriage, parseSignal, TRIAGE_QUESTIONS, triageState, type TriageQuestions } from "./triage";
import type { Answers, JsonValue, Questions } from "./types";

/**
 * Decision tasks: the only things /api/decide will ask Jev. Each task owns
 * its input parser, the state + questions it sends, and a deterministic
 * local fallback with the same answer shapes. The route never proxies raw
 * questions, so the API key can't be used for arbitrary prompts.
 *
 * Planned next (same shape): `route` (command → tool, act if confident),
 * `lead` (Deadbridge lead scoring), `astro` (go/no-go).
 */
export interface DecideTask<I, Qs extends Questions> {
  name: string;
  parse(raw: unknown): I | null;
  build(input: I): { state: JsonValue; questions: Qs };
  local(input: I): Answers<Qs>;
}

const triage: DecideTask<DevSignal, TriageQuestions> = {
  name: "triage",
  parse: parseSignal,
  build: (s) => ({ state: triageState(s), questions: TRIAGE_QUESTIONS }),
  local: localTriage,
};

/* --- (3) second risk check, next to the keyword classifier in dev/risk.ts -- */

export const RISK_QUESTIONS = {
  loses_work: noul("Could running `command` in `cwd` delete files or discard work that is not saved elsewhere?"),
  touches_remote: noul("Does `command` change something outside this machine, such as a git remote, a server, or a cloud service?"),
  hard_to_undo: noul("Would the effect of `command` be hard to undo with a single follow-up command?"),
};
export type RiskQuestions = typeof RISK_QUESTIONS;
export interface RiskInput {
  command: string;
  cwd?: string;
}

const risk: DecideTask<RiskInput, RiskQuestions> = {
  name: "risk",
  parse: (raw) => {
    const r = raw as Partial<RiskInput> | null;
    return r && typeof r.command === "string" && r.command.length <= 500
      ? { command: r.command, cwd: typeof r.cwd === "string" ? r.cwd.slice(0, 200) : undefined }
      : null;
  },
  build: (i) => ({ state: { command: i.command, cwd: i.cwd ?? "a local git repository" }, questions: RISK_QUESTIONS }),
  local: (i) => {
    const k = classifyCommand(i.command);
    const reason = k.reason ?? "";
    return {
      loses_work: localNoul(/deletes|discards/.test(reason) ? 0.85 : 0.1),
      touches_remote: localNoul(/remote|force/.test(reason) ? 0.9 : 0.05),
      hard_to_undo: localNoul(k.risky ? 0.7 : 0.1),
    };
  },
};

export const TASKS = { triage, risk } as const;
export type TaskName = keyof typeof TASKS;
export const isTaskName = (t: unknown): t is TaskName => typeof t === "string" && t in TASKS;
