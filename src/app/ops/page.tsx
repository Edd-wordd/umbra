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
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="border-b border-cyan-400/20 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-cyan-300/70">Umbra Ops</p>
              <h1 className="mt-2 text-xl font-light tracking-[0.22em] text-cyan-100">Needs Edward</h1>
            </div>
            <p className="text-xs text-slate-500">
              sample · {needs.length} needs · {approvals.length} approvals · {view.totals.attention} attention
            </p>
          </div>
        </header>

        <Section title="What changed">
          {whatChanged.quiet ? (
            <Line muted>all quiet</Line>
          ) : (
            whatChanged.lines.map((line) => <Line key={line} tone={line.startsWith("needs") ? "amber" : "cyan"}>{line}</Line>)
          )}
        </Section>

        <Section title="Approvals">
          {approvals.length ? (
            approvals.slice(0, 8).map(({ need, action }) => (
              <Line key={`${need.id}:${action.id}`} tone="amber">
                {action.label} · {action.risk} · {need.title}
                {action.plan?.target ? ` · ${action.plan.target}` : ""}
              </Line>
            ))
          ) : (
            <Line muted>none</Line>
          )}
        </Section>

        <Section title="Sector state">
          <div className="grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            {view.sectors.map((sector) => (
              <div key={sector.domain} className="flex justify-between border-b border-white/5 py-2">
                <span className="uppercase tracking-[0.22em] text-slate-500">{sector.domain}</span>
                <span className={statusColor(sector.status)}>{sector.status}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Needs Edward">
          <div className="space-y-5">
            {needs.map((need) => {
              const decision = triageByNeed.get(need.id);
              return (
                <article key={need.id} className="border-b border-white/10 pb-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-slate-600">{need.severity}</p>
                      <h2 className="mt-1 text-base text-cyan-100">{need.title}</h2>
                      <p className="mt-2 text-xs text-amber-100/75">{need.whyNow}</p>
                    </div>
                    {decision && <p className="text-right text-[10px] text-slate-600">{decision.category} · {decision.priority.toFixed(2)} · {decision.source}</p>}
                  </div>

                  <div className="mt-4 grid gap-4 text-xs lg:grid-cols-2">
                    <div>
                      <p className="uppercase tracking-[0.25em] text-slate-600">Runbooks</p>
                      <div className="mt-2 space-y-1 text-slate-400">
                        {need.runbooks.map((runbook) => <p key={runbook.id}>• {runbook.title}</p>)}
                        {!need.runbooks.length && <p className="text-slate-700">none</p>}
                      </div>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.25em] text-slate-600">Actions</p>
                      <div className="mt-2 space-y-2 text-slate-400">
                        {need.actions.map((action) => (
                          <p key={action.id}>
                            <span className="text-cyan-200">{action.label}</span> · {action.risk} · {action.requiresApproval ? "approval" : "safe"}
                            {action.plan?.target ? <span className="text-slate-600"> · {action.plan.target}</span> : null}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 border-b border-white/10 pb-2 text-xs uppercase tracking-[0.32em] text-cyan-300/70">{title}</h2>
      {children}
    </section>
  );
}

function Line({ children, tone, muted = false }: { children: React.ReactNode; tone?: "cyan" | "amber"; muted?: boolean }) {
  const color = muted ? "text-slate-700" : tone === "amber" ? "text-amber-100/85" : tone === "cyan" ? "text-cyan-100/85" : "text-slate-300";
  return <p className={`border-l border-cyan-400/20 py-1 pl-3 text-sm ${color}`}>{children}</p>;
}

function statusColor(status: string) {
  if (status === "blocked" || status === "critical") return "text-red-300";
  if (status === "approval" || status === "judgment") return "text-amber-200";
  if (status === "watch" || status === "actionable") return "text-cyan-200";
  return "text-slate-600";
}
