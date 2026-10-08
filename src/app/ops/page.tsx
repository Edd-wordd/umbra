import { buildBrainViewModel } from "@/lib/brain";
import { createSampleMultiDomainBrain } from "@/lib/domain";
import { buildOpsNeeds, buildWhatChanged, localTriageOpsNeeds } from "@/lib/ops";

export default async function OpsPage() {
  const now = 1_700_000_000_000;
  const brain = createSampleMultiDomainBrain(now);
  const needs = await buildOpsNeeds(brain);
  const triage = localTriageOpsNeeds(needs);
  const triageByNeed = new Map(triage.map((item) => [item.needId, item]));
  const whatChanged = buildWhatChanged({ since: now - 60 * 60_000, generatedAt: now, needs, memory: brain.memory, limit: 6 });
  const view = buildBrainViewModel(brain);
  const approvals = needs.flatMap((need) => need.actions.filter((action) => action.requiresApproval).map((action) => ({ need, action })));

  return (
    <main className="h-screen overflow-y-auto bg-[#050607] p-8 text-[#d7e4e8]">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border border-cyan-400/20 bg-black/30 p-5">
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-300/70">Umbra Ops</p>
          <h1 className="mt-2 text-2xl font-light tracking-[0.2em] text-cyan-100">What needs Edward</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Cross-domain operational surface. Sample-backed for now; actions are dry-run and approval-aware.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="needs" value={needs.length} tone="amber" />
          <Metric label="approvals" value={approvals.length} tone="amber" />
          <Metric label="attention" value={view.totals.attention} tone="cyan" />
          <Metric label="situations" value={view.totals.situations} tone="cyan" />
        </section>

        <Panel title="What changed since I left?">
          {whatChanged.quiet ? (
            <p className="text-sm text-slate-500">all quiet</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-300">
              {whatChanged.lines.map((line) => (
                <li key={line} className="border-l border-cyan-400/30 pl-3">
                  <span className={line.startsWith("needs") ? "text-amber-200" : "text-cyan-200"}>{line.split(" · ")[0]}</span>
                  <span className="text-slate-600"> · </span>
                  {line.split(" · ").slice(1).join(" · ")}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Approvals">
            <ul className="space-y-3 text-sm text-slate-300">
              {approvals.slice(0, 8).map(({ need, action }) => (
                <li key={`${need.id}:${action.id}`} className="border-l border-amber-300/40 pl-3">
                  <p><span className="text-amber-200">{action.label}</span> · {action.risk}</p>
                  <p className="mt-1 text-slate-500">{need.title}</p>
                  {action.plan && <p className="mt-1 text-slate-600">{action.plan.summary}{action.plan.target ? ` → ${action.plan.target}` : ""}</p>}
                </li>
              ))}
              {!approvals.length && <li className="text-slate-600">none</li>}
            </ul>
          </Panel>

          <Panel title="Sector state">
            <ul className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              {view.sectors.map((sector) => (
                <li key={sector.domain} className="flex justify-between border border-white/10 px-3 py-2">
                  <span className="uppercase tracking-[0.2em] text-slate-500">{sector.domain}</span>
                  <span className={statusColor(sector.status)}>{sector.status}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <Panel title="Needs Edward">
          <div className="space-y-4">
            {needs.map((need) => {
              const decision = triageByNeed.get(need.id);
              return (
                <article key={need.id} className="border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{need.severity}</p>
                      <h2 className="mt-1 text-lg text-cyan-100">{need.title}</h2>
                      <p className="mt-2 text-sm text-amber-100/80">why now: {need.whyNow}</p>
                    </div>
                    {decision && <p className="text-xs text-slate-500">{decision.category} · priority {decision.priority.toFixed(2)} · {decision.source}</p>}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-xs uppercase tracking-[0.25em] text-slate-500">Runbooks</h3>
                      <ul className="mt-2 space-y-1 text-sm text-slate-300">
                        {need.runbooks.map((runbook) => <li key={runbook.id}>• {runbook.title}</li>)}
                        {!need.runbooks.length && <li className="text-slate-600">none</li>}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-xs uppercase tracking-[0.25em] text-slate-500">Actions</h3>
                      <ul className="mt-2 space-y-3 text-sm text-slate-300">
                        {need.actions.map((action) => (
                          <li key={action.id} className="border-l border-cyan-400/30 pl-3">
                            <p><span className="text-cyan-200">{action.label}</span> · {action.risk} · {action.requiresApproval ? "approval required" : "no approval"}</p>
                            {action.plan && <p className="mt-1 text-slate-500">{action.plan.summary}{action.plan.target ? ` → ${action.plan.target}` : ""}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Panel>
      </div>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "cyan" | "amber" }) {
  return (
    <div className="border border-white/10 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className={tone === "amber" ? "mt-2 text-3xl font-light text-amber-100" : "mt-2 text-3xl font-light text-cyan-100"}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-white/10 bg-black/30 p-4">
      <h2 className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300/70">{title}</h2>
      {children}
    </section>
  );
}

function statusColor(status: string) {
  if (status === "blocked" || status === "critical") return "text-red-300";
  if (status === "approval" || status === "judgment") return "text-amber-200";
  if (status === "watch" || status === "actionable") return "text-cyan-200";
  return "text-slate-600";
}
