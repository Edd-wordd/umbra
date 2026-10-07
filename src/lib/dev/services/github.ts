import { formatAge } from "../format";
import { defineService, notConnected, type ServiceNeed, type ServiceRow } from "./types";

const DAY = 24 * 60 * 60_000;

/** Solo-dev view of a repo: what is not committed, not pushed, gone stale, and is CI green. */
export interface GithubPayload {
  /** null = local-only repo (no remote configured). */
  remote: string | null;
  branch: string;
  uncommitted: number;
  /** Commits not on the remote (with no remote: commits never pushed anywhere). */
  ahead: number;
  /** Live: commits on the remote not pulled yet (when tracking). */
  behind?: number;
  /** Live: commit time of the oldest unpushed commit. */
  oldestUnpushedAt?: number;
  staleBranches: { name: string; days: number }[];
  lastCommit: { sha: string; message: string; at: number };
  openPrs: number;
  workflows: boolean;
  /** Last local check when there is no CI (e.g. "lint ✓ build ✓"). */
  localChecks?: { text: string; at: number };
  /** Why CI is unknown (e.g. gh not logged in). */
  ciNote?: string;
}

export const github = defineService<GithubPayload>({
  id: "github",
  label: "github",
  chip: "gh",
  blurb: "git state, unpushed work, stale branches, actions",
  read(p, ctx) {
    if (!p) return notConnected("GitHub");
    const run = ctx.ci.find((r) => r.repo === ctx.project.repo);
    const rows: ServiceRow[] = [
      { k: "branch", v: `${p.branch} · ${p.uncommitted ? `${p.uncommitted} uncommitted` : "clean"}` },
      p.remote
        ? {
            k: "remote",
            v: `${p.remote} · ${p.ahead ? `${p.ahead} unpushed` : p.behind ? "" : "in sync"}${p.behind ? `${p.ahead ? " · " : ""}${p.behind} behind` : ""}${
              p.ahead && p.oldestUnpushedAt ? ` · oldest ${formatAge(ctx.now - p.oldestUnpushedAt)}` : ""
            }`,
            tone: p.ahead ? "attention" : undefined,
          }
        : { k: "remote", v: `none · local only · ${p.ahead} commits not backed up`, tone: "attention" },
      { k: "last commit", v: `${p.lastCommit.sha} ${p.lastCommit.message} · ${formatAge(ctx.now - p.lastCommit.at)}` },
      {
        k: "stale >14d",
        v: p.staleBranches.length ? p.staleBranches.map((b) => `${b.name} ${b.days}d`).join(" · ") : "none",
        tone: p.staleBranches.length ? undefined : "dim",
      },
    ];

    if (run) {
      const mark = run.status === "failed" ? "✕" : run.status === "running" ? "◌" : run.status === "cancelled" ? "–" : "✓";
      rows.push({
        k: "actions",
        v: `#${run.number} ${mark} ${run.status === "running" ? `running · ${run.summary}` : run.summary} · ${formatAge(ctx.now - run.at)}`,
        tone: run.status === "failed" ? "broken" : run.status === "running" ? "active" : undefined,
      });
      if (run.status === "failed") {
        run.failing.forEach((t) => rows.push({ k: "failing", v: `✕ ${t}`, tone: "broken" }));
        if (run.sentryId) rows.push({ k: "sentry", v: `≈ matches ${run.sentryId} · same frame`, tone: "attention" });
      }
    } else if (!p.remote) {
      rows.push({ k: "actions", v: "n/a · no remote", tone: "dim" });
    } else if (p.ciNote) {
      rows.push({ k: "actions", v: p.ciNote, tone: "dim" });
    } else {
      rows.push({ k: "actions", v: p.workflows ? "no runs yet" : "no workflows", tone: "dim" });
    }
    if (p.localChecks) rows.push({ k: "local checks", v: `${p.localChecks.text} · ${formatAge(ctx.now - p.localChecks.at)}` });
    rows.push({ k: "open PRs", v: String(p.openPrs), tone: "dim" });

    const failed = run?.status === "failed";
    const needs: ServiceNeed[] = [];
    if (failed)
      needs.push({
        tone: "broken",
        text: `ci #${run.number} ✕ ${run.summary.split(" · ")[0]}`,
        refs: [run.id, ...(run.sentryId ? [run.sentryId] : [])],
        action: { label: "run tests", toolId: "dev.tests.run", args: { repo: ctx.project.repo } },
      });
    // Solo dev: work that exists only on this laptop is the real risk.
    if (!p.remote && p.ahead) needs.push({ tone: "attention", text: `${p.ahead} commits not backed up · no remote` });
    else if (p.remote && p.ahead && ctx.now - (p.oldestUnpushedAt ?? p.lastCommit.at) > DAY)
      needs.push({ tone: "attention", text: `${p.ahead} unpushed · oldest ${formatAge(ctx.now - (p.oldestUnpushedAt ?? p.lastCommit.at))}` });

    return {
      status: failed ? "broken" : needs.length ? "attention" : run?.status === "running" ? "active" : "ok",
      needs,
      summary: failed
        ? `ci #${run.number} ✕ ${run.summary.split(" · ")[0]}`
        : run?.status === "running"
          ? `ci #${run.number} running`
          : `${p.uncommitted ? `${p.uncommitted} uncommitted` : "clean"}${p.remote ? "" : " · no remote"}`,
      rows,
      wide: true,
      actions: [
        ...(failed ? [{ label: "run tests", toolId: "dev.tests.run", args: { repo: ctx.project.repo } }] : []),
        ...(p.remote ? [{ label: "open repo ↗", toolId: "dev.link.open", args: { label: `github ${p.remote}` } }] : []),
      ],
    };
  },
});
