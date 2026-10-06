/**
 * Command risk classifier. Anything matched here never runs straight from
 * the terminal input: it raises an inline approval strip first, and the
 * bridge refuses it unless the request carries `approved: true`.
 */

export interface CommandRisk {
  risky: boolean;
  /** Short ops-toned reason shown on the approval strip. */
  reason?: string;
}

const RULES: readonly { re: RegExp; reason: string }[] = [
  { re: /\breset\s+--hard\b/, reason: "discards local changes" },
  { re: /--force\b|--force-with-lease\b|\bpush\s+(?:\S+\s+)*-f\b/, reason: "force flag" },
  { re: /\bpush\b/, reason: "pushes to a remote" },
  { re: /(?:^|[\s;&|])rm(?:\s|$)/, reason: "deletes files" },
  { re: /(?:^|[\s;&|])(?:kill|pkill|killall)(?:\s|$)/, reason: "kills a process" },
  { re: /(?:^|[\s;&|])sudo(?:\s|$)/, reason: "runs as root" },
];

export function classifyCommand(command: string): CommandRisk {
  const c = command.trim();
  for (const r of RULES) if (r.re.test(c)) return { risky: true, reason: r.reason };
  return { risky: false };
}
