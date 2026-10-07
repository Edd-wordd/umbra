import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { HELPER_DIR } from "./config.js";

/** Append-only audit trail: helper/logs/audit.jsonl (gitignored). One JSON object per line. */
export const LOG_DIR = process.env.UMBRA_HELPER_LOGS ?? join(HELPER_DIR, "logs");
const DIR = LOG_DIR;
export const AUDIT_FILE = join(DIR, "audit.jsonl");

export function audit(entry: { action: string; result: "ok" | "refused" | "error" | "issued" | "info"; [k: string]: unknown }) {
  try {
    mkdirSync(DIR, { recursive: true });
    appendFileSync(AUDIT_FILE, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", { mode: 0o600 });
  } catch (e) {
    console.error("[audit] write failed:", (e as Error).message);
  }
}
