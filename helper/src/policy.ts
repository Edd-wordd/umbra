import { createHash, randomBytes } from "node:crypto";
import type { WireRequest } from "./protocol.js";

/**
 * The helper's own command policy. The app's approval strip is the UX; this
 * is the enforcement: risky requests run only with a single-use approval id
 * that was minted (via POST /approvals, long-lived token) for that exact
 * action within the last 60 s. Read-only requests are free.
 */
const RULES: readonly { re: RegExp; reason: string }[] = [
  { re: /\breset\s+--hard\b/, reason: "discards local changes" },
  { re: /\bclean\s+-[a-z]*f/, reason: "deletes untracked files" },
  { re: /\bcheckout\s+(?:--\s+)?\.(?:\s|$)|\brestore\s+(?:--\S+\s+)*\./, reason: "discards local changes" },
  { re: /--force\b|--force-with-lease\b|\bpush\s+(?:\S+\s+)*-f\b/, reason: "force flag" },
  { re: /\bpush\b/, reason: "pushes to a remote" },
  { re: /\bbranch\s+-D\b/, reason: "deletes a branch" },
  { re: /(?:^|[\s;&|(])rm(?:\s|$)|\brmdir\b|\bunlink\b/, reason: "deletes files" },
  { re: /(?:^|[\s;&|(])(?:kill|pkill|killall)(?:\s|$)/, reason: "kills a process" },
  { re: /(?:^|[\s;&|(])sudo(?:\s|$)/, reason: "runs as root" },
  { re: /\brestart\b|\blaunchctl\s+(?:kickstart|bootout|unload|stop)\b|\bdocker\s+(?:compose\s+)?(?:stop|down|rm|kill)\b/, reason: "restarts or stops a service" },
  { re: /\b(?:shutdown|reboot|halt)\b/, reason: "power action" },
  { re: /\bmkfs|\bdd\s+if=|>\s*\/dev\/(?!null)/, reason: "writes a device" },
  { re: /\b(?:curl|wget)\b[^|]*\|\s*(?:ba|z)?sh\b/, reason: "pipes a download into a shell" },
  { re: /\bchmod\s+-R\b|\bchown\s+-R\b/, reason: "recursive permission change" },
];

export function classifyCommand(command: string): { risky: boolean; reason?: string } {
  const c = command.trim();
  for (const r of RULES) if (r.re.test(c)) return { risky: true, reason: r.reason };
  return { risky: false };
}

/** Is this request risky under helper policy? (process.kill always; term.exec by command.) */
export function riskOf(req: WireRequest): { risky: boolean; reason?: string } {
  if (req.type === "process.kill") return { risky: true, reason: "kills a process" };
  if (req.type === "term.exec") return classifyCommand(req.command);
  return { risky: false };
}

/** The exact action an approval is bound to (no `approved` / `approvalId`). */
export function actionKey(req: WireRequest): string {
  const core =
    req.type === "process.kill"
      ? { type: req.type, pid: req.pid }
      : req.type === "term.exec"
        ? { type: req.type, sessionId: req.sessionId, command: req.command.trim() }
        : { type: req.type };
  return createHash("sha256").update(JSON.stringify(core)).digest("hex");
}

interface Approval {
  id: string;
  key: string;
  expires: number;
}

const TTL = 60_000;

export class Approvals {
  private items = new Map<string, Approval>();

  issue(req: WireRequest): { approvalId: string; expiresAt: number } {
    this.sweep();
    const id = `ap_${randomBytes(12).toString("base64url")}`;
    const expires = Date.now() + TTL;
    this.items.set(id, { id, key: actionKey(req), expires });
    return { approvalId: id, expiresAt: expires };
  }

  /** Single use: valid only for the same action, once, before expiry. */
  consume(id: string | undefined, req: WireRequest): { ok: true } | { ok: false; why: string } {
    this.sweep();
    if (!id) return { ok: false, why: "no approval id" };
    const a = this.items.get(id);
    if (!a) return { ok: false, why: "unknown or expired approval" };
    this.items.delete(id);
    if (a.key !== actionKey(req)) return { ok: false, why: "approval was for a different action" };
    return { ok: true };
  }

  private sweep() {
    const now = Date.now();
    for (const [id, a] of this.items) if (a.expires < now) this.items.delete(id);
  }
}
