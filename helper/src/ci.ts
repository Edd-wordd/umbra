import { run } from "./exec.js";
import type { CiRun, CiStatus } from "./protocol.js";

/**
 * GitHub Actions via the `gh` CLI. Nothing here holds a GitHub token: gh
 * uses its own login (`gh auth login`). If gh is missing or logged out, CI
 * is reported as unknown and nothing else breaks.
 */
export interface GhState {
  available: boolean;
  authed: boolean;
  note: string;
}

const GH = process.env.UMBRA_GH ?? "gh";

export async function ghState(): Promise<GhState> {
  const v = await run(GH, ["--version"], { timeoutMs: 5000 });
  if (!v.ok) return { available: false, authed: false, note: "unknown · gh not installed" };
  const a = await run(GH, ["auth", "status"], { timeoutMs: 8000 });
  return a.ok ? { available: true, authed: true, note: "" } : { available: true, authed: false, note: "unknown · gh not logged in (gh auth login)" };
}

interface GhRun {
  databaseId: number;
  number: number;
  status: string;
  conclusion: string;
  headBranch: string;
  displayTitle: string;
  workflowName: string;
  updatedAt: string;
  createdAt: string;
  url?: string;
}

export function mapStatus(r: Pick<GhRun, "status" | "conclusion">): CiStatus {
  if (r.status !== "completed") return "running";
  if (r.conclusion === "success") return "passed";
  if (["failure", "timed_out", "startup_failure", "action_required"].includes(r.conclusion)) return "failed";
  return "cancelled";
}

export async function latestRun(repo: string, slug: string): Promise<CiRun | null> {
  const r = await run(
    GH,
    ["run", "list", "--repo", slug, "--limit", "1", "--json", "databaseId,number,status,conclusion,headBranch,displayTitle,workflowName,updatedAt,createdAt,url"],
    { timeoutMs: 15000 },
  );
  if (!r.ok) return null;
  const [x] = JSON.parse(r.stdout || "[]") as GhRun[];
  if (!x) return null;
  const status = mapStatus(x);
  let failing: string[] = [];
  if (status === "failed") {
    const v = await run(GH, ["run", "view", String(x.databaseId), "--repo", slug, "--json", "jobs"], { timeoutMs: 15000 });
    if (v.ok) {
      const { jobs = [] } = JSON.parse(v.stdout || "{}") as { jobs?: { name: string; conclusion: string; steps?: { name: string; conclusion: string }[] }[] };
      failing = jobs
        .filter((j) => j.conclusion === "failure")
        .map((j) => {
          const step = j.steps?.find((s) => s.conclusion === "failure");
          return step ? `${j.name} › ${step.name}` : j.name;
        })
        .slice(0, 4);
    }
  }
  const summary =
    status === "failed"
      ? `${failing.length || 1} job${failing.length > 1 ? "s" : ""} failed · ${x.workflowName}`
      : status === "running"
        ? `${x.workflowName} · ${x.status.replace("_", " ")}`
        : status === "cancelled"
          ? `${x.conclusion || "cancelled"} · ${x.workflowName}`
          : `${x.workflowName} · passed`;
  return {
    id: `ci-${repo}-${x.databaseId}`,
    repo,
    branch: x.headBranch,
    number: x.number,
    status,
    summary,
    failing,
    at: Date.parse(x.updatedAt || x.createdAt) || Date.now(),
    url: x.url,
  };
}

export async function openPrCount(slug: string): Promise<number | null> {
  const r = await run(GH, ["pr", "list", "--repo", slug, "--state", "open", "--limit", "50", "--json", "number"], { timeoutMs: 15000 });
  if (!r.ok) return null;
  return (JSON.parse(r.stdout || "[]") as unknown[]).length;
}
