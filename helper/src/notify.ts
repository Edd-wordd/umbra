import { appendFileSync } from "node:fs";
import { findBin, run } from "./exec.js";

/**
 * Native macOS notifications. Never through a shell:
 *  - terminal-notifier (brew install terminal-notifier): clickable, `-open <jump url>`,
 *    `-group` so a newer ping about the same thing replaces the older one.
 *  - osascript fallback: `display notification` can't open a link on click, so the
 *    helper also keeps the ping in its recent list (GET /pings). The text goes in
 *    as `argv` to an `on run argv` handler, never spliced into AppleScript source.
 * UMBRA_PINGS_FILE=/path writes each ping there as a JSON line instead (tests).
 */
export interface Notice {
  title: string;
  subtitle: string;
  message: string;
  url?: string;
  group: string;
}

export type Delivery = "terminal-notifier" | "osascript" | "file" | "off" | "failed";

/** One line, no control characters, bounded, and never starting with "-" or "[" (both CLIs would read it as an option). */
export function clean(s: string, max = 220): string {
  const t = s
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cut = t.length > max ? `${t.slice(0, max - 1)}…` : t;
  return /^[-[]/.test(cut) ? `\u200b${cut}` : cut;
}

/** AppleScript string literal (only for fixed values; user text goes through argv). */
export const appleString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export function notifierName(pref: "auto" | "terminal-notifier" | "osascript" | "off"): "terminal-notifier" | "osascript" | "off" {
  if (pref === "off") return "off";
  if (pref !== "osascript" && findBin("terminal-notifier")) return "terminal-notifier";
  return process.platform === "darwin" ? "osascript" : "off";
}

export async function deliver(n: Notice, opts: { notifier: "auto" | "terminal-notifier" | "osascript" | "off"; sound: string }): Promise<Delivery> {
  const title = clean(n.title, 120);
  const subtitle = clean(n.subtitle, 120);
  const message = clean(n.message);
  const file = process.env.UMBRA_PINGS_FILE;
  if (file) {
    appendFileSync(file, JSON.stringify({ at: Date.now(), title, subtitle, message, url: n.url, group: n.group }) + "\n");
    return "file";
  }
  const which = notifierName(opts.notifier);
  if (which === "terminal-notifier") {
    const bin = findBin("terminal-notifier")!;
    const args = ["-title", title, "-subtitle", subtitle, "-message", message, "-group", n.group];
    if (n.url) args.push("-open", n.url);
    if (opts.sound) args.push("-sound", opts.sound);
    const r = await run(bin, args, { timeoutMs: 10_000 });
    if (r.ok) return "terminal-notifier";
    console.error("[ping] terminal-notifier failed:", (r.stderr || r.stdout).trim().slice(0, 200), "· trying osascript");
  }
  if (which === "off" || process.platform !== "darwin") return "off";
  const show = `display notification (item 1 of argv) with title (item 2 of argv) subtitle (item 3 of argv)${opts.sound ? ` sound name ${appleString(opts.sound)}` : ""}`;
  const r = await run("/usr/bin/osascript", ["-e", "on run argv", "-e", show, "-e", "end run", message, title, subtitle], { timeoutMs: 10_000 });
  if (!r.ok) console.error("[ping] osascript failed:", r.stderr.trim().slice(0, 200));
  return r.ok ? "osascript" : "failed";
}
