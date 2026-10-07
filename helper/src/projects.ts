import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { HSnapshot, HerdrStatus } from "./herdr.js";

/**
 * Herdr workspaces → Umbra projects.
 *
 * A workspace's project is the git root of its agent panes' cwd (weighted),
 * else of any pane cwd inside a repo; panes sitting in $HOME don't count.
 * Workspaces on the same root merge (Edward keeps two parallax and two
 * deadbridge-site workspaces open), keeping both workspace ids.
 */

export interface DerivedProject {
  repo: string;
  dir: string;
  label: string;
  workspaces: string[];
  agentStatus: HerdrStatus;
}

const RANK: Record<HerdrStatus, number> = { blocked: 4, working: 3, done: 2, idle: 1, unknown: 0 };
export const worstStatus = (a: HerdrStatus, b: HerdrStatus) => (RANK[b] > RANK[a] ? b : a);

const rootCache = new Map<string, { root: string | null; at: number }>();

/** Nearest ancestor with a .git entry (dir or worktree file); never $HOME or /. */
export function gitRoot(cwd: string | null | undefined): string | null {
  if (!cwd) return null;
  const hit = rootCache.get(cwd);
  if (hit && Date.now() - hit.at < 60_000) return hit.root;
  const home = homedir();
  let root: string | null = null;
  let dir = cwd;
  for (let i = 0; i < 32; i++) {
    if (dir === home || dir === "/" || dir === dirname(home)) break;
    if (existsSync(join(dir, ".git"))) {
      try {
        root = realpathSync(dir);
      } catch {
        root = dir;
      }
      break;
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  rootCache.set(cwd, { root, at: Date.now() });
  return root;
}

export function deriveProjects(snap: HSnapshot, resolveRoot: (cwd: string | null | undefined) => string | null = gitRoot): DerivedProject[] {
  const byRoot = new Map<string, DerivedProject & { number: number }>();
  const workspaces = [...snap.workspaces].sort((a, b) => a.number - b.number);
  for (const ws of workspaces) {
    const votes = new Map<string, number>();
    const vote = (cwd: string | null | undefined, w: number) => {
      const r = resolveRoot(cwd);
      if (r) votes.set(r, (votes.get(r) ?? 0) + w);
    };
    for (const a of snap.agents.filter((x) => x.workspace_id === ws.workspace_id)) {
      vote(a.foreground_cwd ?? a.cwd, 3);
      if (a.cwd !== a.foreground_cwd) vote(a.cwd, 2);
    }
    for (const p of snap.panes.filter((x) => x.workspace_id === ws.workspace_id && !x.agent)) vote(p.foreground_cwd ?? p.cwd, 1);
    const root = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!root) continue;
    const prev = byRoot.get(root);
    if (prev) {
      prev.workspaces.push(ws.workspace_id);
      prev.agentStatus = worstStatus(prev.agentStatus, ws.agent_status);
    } else {
      byRoot.set(root, { repo: basename(root), dir: root, label: ws.label || basename(root), workspaces: [ws.workspace_id], agentStatus: ws.agent_status, number: ws.number });
    }
  }
  // Unique ids: folder name, suffixed on collision (two "app" repos in different places).
  const seen = new Map<string, number>();
  return [...byRoot.values()].map((x) => {
    const p: DerivedProject = { repo: x.repo, dir: x.dir, label: x.label, workspaces: x.workspaces, agentStatus: x.agentStatus };
    const n = (seen.get(p.repo) ?? 0) + 1;
    seen.set(p.repo, n);
    return n > 1 ? { ...p, repo: `${p.repo}-${n}` } : p;
  });
}
