import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { run } from "./exec.js";
import type { GitPayload } from "./protocol.js";

/** Solo-dev git state for one repo (shape = github service payload). */
const DAY = 86_400_000;

const git = (cwd: string, args: string[]) => run("git", ["-C", cwd, ...args], { timeoutMs: 8000, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" } });

/** owner/name from an https or ssh GitHub URL; otherwise the URL itself. */
export function remoteSlug(url: string): string {
  const m = /github\.com[:/]+([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? m[1] : url.trim();
}

export interface StatusV2 {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  changes: number;
}

export function parseStatusV2(out: string): StatusV2 {
  const s: StatusV2 = { branch: "HEAD", upstream: null, ahead: 0, behind: 0, changes: 0 };
  for (const line of out.split("\n")) {
    if (!line) continue;
    if (line.startsWith("# branch.head ")) s.branch = line.slice(14).trim();
    else if (line.startsWith("# branch.upstream ")) s.upstream = line.slice(18).trim();
    else if (line.startsWith("# branch.ab ")) {
      const m = /\+(\d+) -(\d+)/.exec(line);
      if (m) {
        s.ahead = Number(m[1]);
        s.behind = Number(m[2]);
      }
    } else if (!line.startsWith("#")) s.changes++;
  }
  if (s.branch === "(detached)") s.branch = "detached";
  return s;
}

export interface GitState {
  payload: GitPayload;
  /** Last time anything happened (commit or index write), for orphan / hand-off heuristics. */
  activityAt: number;
  /** owner/name when the remote is on GitHub (for gh). */
  github: string | null;
}

export async function readGit(dir: string, staleDays: number): Promise<GitState | null> {
  if (!existsSync(join(dir, ".git"))) return null;
  const [status, remoteUrl, last, refs] = await Promise.all([
    git(dir, ["status", "--porcelain=v2", "--branch"]),
    git(dir, ["remote", "get-url", "origin"]),
    git(dir, ["log", "-1", "--format=%h%x09%ct%x09%s"]),
    git(dir, ["for-each-ref", "--format=%(refname:short)%09%(committerdate:unix)", "refs/heads"]),
  ]);
  if (!status.ok) return null;
  const st = parseStatusV2(status.stdout);

  let remote: string | null = null;
  if (remoteUrl.ok && remoteUrl.stdout.trim()) remote = remoteSlug(remoteUrl.stdout);
  else {
    const any = await git(dir, ["remote"]);
    const first = any.stdout.split("\n").find(Boolean);
    if (first) {
      const u = await git(dir, ["remote", "get-url", first]);
      remote = u.ok ? remoteSlug(u.stdout) : first;
    }
  }

  // Unpushed: vs upstream when tracking, vs any remote ref otherwise; with no remote, every commit.
  const range = st.upstream ? ["@{u}..HEAD"] : remote ? ["HEAD", "--not", "--remotes"] : ["HEAD"];
  const unpushed = last.ok && last.stdout.trim() ? await git(dir, ["log", "--format=%ct", ...range]) : { stdout: "" };
  const times = unpushed.stdout.split("\n").filter(Boolean).map((t) => Number(t) * 1000);
  const ahead = st.upstream ? st.ahead : times.length;

  const [sha = "", ct = "0", ...msg] = last.stdout.trim().split("\t");
  const lastAt = Number(ct) * 1000;
  const now = Date.now();
  const staleBranches = refs.stdout
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, t] = l.split("\t");
      return { name, days: Math.floor((now - Number(t) * 1000) / DAY) };
    })
    .filter((b) => b.name !== st.branch && b.days > staleDays)
    .sort((a, b) => b.days - a.days)
    .slice(0, 6);

  let indexAt = 0;
  try {
    indexAt = statSync(join(dir, ".git", "index")).mtimeMs;
  } catch {
    /* fresh repo */
  }

  return {
    payload: {
      remote,
      branch: st.branch,
      uncommitted: st.changes,
      ahead,
      behind: st.upstream ? st.behind : undefined,
      oldestUnpushedAt: times.length ? Math.min(...times) : undefined,
      staleBranches,
      lastCommit: { sha, message: msg.join("\t") || "(no commits)", at: lastAt || now },
      openPrs: 0,
      workflows: existsSync(join(dir, ".github", "workflows")),
    },
    activityAt: Math.max(lastAt, indexAt),
    github: remote && /^[^/\s]+\/[^/\s]+$/.test(remote) && remoteUrl.stdout.includes("github.com") ? remote : null,
  };
}
