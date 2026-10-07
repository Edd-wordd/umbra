import { classifyCommand } from "../dev/risk";
import { decideMany } from "./client";
import type { RiskQuestions } from "./tasks";
import type { Answers, DecisionSource } from "./types";

/**
 * Second risk check (not wired yet): the keyword classifier in dev/risk.ts
 * stays the first gate; this asks Jev three atomic questions and holds the
 * command if either says so. It can only add a hold, never remove one.
 */
export interface RiskVerdict {
  risky: boolean;
  reason?: string;
  source: DecisionSource | "keywords";
}

export async function secondRiskCheck(command: string, cwd?: string): Promise<RiskVerdict> {
  const first = classifyCommand(command);
  if (first.risky) return { risky: true, reason: first.reason, source: "keywords" };
  const [r] = await decideMany("risk", [{ id: "risk", input: { command, cwd } }]);
  if (!r) return { risky: false, source: "local" };
  const a = r.answers as Answers<RiskQuestions>;
  const flags = [a.loses_work.noul >= 0.5 && "may lose work", a.touches_remote.noul >= 0.5 && "touches a remote", a.hard_to_undo.noul >= 0.6 && "hard to undo"].filter(
    Boolean,
  ) as string[];
  return flags.length ? { risky: true, reason: flags.join(" · "), source: r.source } : { risky: false, source: r.source };
}
