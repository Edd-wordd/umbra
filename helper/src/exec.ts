import { execFile } from "node:child_process";

export interface RunResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Run a program (no shell) with a timeout. Never throws. */
export function run(file: string, args: string[], opts: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { cwd: opts.cwd, timeout: opts.timeoutMs ?? 8000, maxBuffer: 8 * 1024 * 1024, env: opts.env ?? process.env, windowsHide: true },
      (err, stdout, stderr) => {
        const code = err ? (typeof (err as NodeJS.ErrnoException & { code?: unknown }).code === "number" ? ((err as unknown as { code: number }).code) : null) : 0;
        resolve({ ok: !err, code, stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

/** Resolve a binary from common macOS/Linux locations when PATH is minimal (launchd). */
export const BIN_DIRS = ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
