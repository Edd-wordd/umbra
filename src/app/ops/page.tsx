import { ApprovalDecisionButtons } from "./ApprovalDecisionButtons";
import { ExecuteActionButton } from "./ExecuteActionButton";
import { getExecutionReadiness } from "@/lib/actions/readiness";
import { readApprovalRequestsFile } from "@/lib/approvals/store-server";
import { buildBrainViewModel } from "@/lib/brain";
import { createGraph, upsertEdges, upsertNodes } from "@/lib/brain/graph";
import { createSampleMultiDomainBrain } from "@/lib/domain";
import { LAB_DOMAIN_ADAPTER } from "@/lib/domain/lab";
import { buildDomainPipeline } from "@/lib/domain/pipeline";
import { getLiveKnowledgeDomain } from "@/lib/domain/knowledge-server";
import { getLabHealth } from "@/lib/lab/health-server";
import { listMemoryEvents } from "@/lib/memory";
import { readJournalEvents } from "@/lib/memory/journal-server";
import { labHealthToSnapshot } from "@/lib/lab/health-to-snapshot";
import { buildOpsNeeds, buildWhatChanged, localTriageOpsNeeds } from "@/lib/ops";
import { getOpsTimeline } from "@/lib/ops/timeline-server";

export default async function OpsPage() {
  const now = 1_700_000_000_000;
  const baseBrain = createSampleMultiDomainBrain(now);
  const liveKnowledge = await getLiveKnowledgeDomain(now);
  const labHealth = await getLabHealth();
  const liveLab = labHealth.configured ? buildDomainPipeline(LAB_DOMAIN_ADAPTER, labHealthToSnapshot(labHealth), now) : null;
  let brain = baseBrain;
  if (liveKnowledge.configured && !liveKnowledge.error) {
    brain = {
      ...brain,
      graph: createGraph(upsertNodes(brain.graph.nodes, liveKnowledge.graph.nodes), upsertEdges(brain.graph.edges, liveKnowledge.graph.edges)),
      situations: [...brain.situations.filter((situation) => !situation.id.startsWith("situation:knowledge:")), ...liveKnowledge.situations],
      memory: brain.memory,
    };
  }
  if (liveLab) {
    brain = {
      ...brain,
      graph: createGraph(
        upsertNodes(brain.graph.nodes.filter((node) => node.domain !== "lab"), liveLab.graph.nodes),
        upsertEdges(brain.graph.edges.filter((edge) => !edge.from.includes(":lab:") && !edge.to.includes(":lab:")), liveLab.graph.edges),
      ),
      situations: [...brain.situations.filter((situation) => !situation.id.startsWith("situation:lab:")), ...liveLab.situations],
      memory: [...brain.memory.filter((event) => !event.id.includes(":lab:")), ...liveLab.memory],
    };
  }
  const needs = await buildOpsNeeds(brain);
  const triage = localTriageOpsNeeds(needs);
  const triageByNeed = new Map(triage.map((item) => [item.needId, item]));
  const whatChanged = buildWhatChanged({ since: now - 60 * 60_000, generatedAt: now, needs, memory: brain.memory, limit: 6 });
  const view = buildBrainViewModel(brain);
  const queuedApprovals = await readApprovalRequestsFile();
  const pendingQueuedApprovals = queuedApprovals.filter((approval) => approval.status === "pending");
  const decidedQueuedApprovals = queuedApprovals.filter((approval) => approval.status !== "pending").slice(0, 6);
  const approvals = needs.flatMap((need) => need.actions.filter((action) => action.requiresApproval).map((action) => ({ need, action })));
  const journalEvents = await readJournalEvents(24);
  const recentActionEvents = [...journalEvents, ...listMemoryEvents(8)].filter((event) => event.type.startsWith("action.")).slice(0, 8);
  const latestKnowledgeNote = journalEvents.find((event) => event.actionId?.startsWith("knowledge.") && event.result === "ok");
  const timeline = await getOpsTimeline(16);

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
              sample · {liveKnowledge.configured && !liveKnowledge.error ? `vault ${liveKnowledge.accepted}/${liveKnowledge.rejected}` : "vault sample"} · {needs.length} needs · {approvals.length + pendingQueuedApprovals.length} approvals · {view.totals.attention} attention
            </p>
          </div>
        </header>

        <Section title="Timeline">
          {timeline.length ? (
            timeline.map((item) => (
              <Line key={item.id} tone={item.tone === "muted" ? undefined : item.tone}>
                {formatTime(item.at)} · {item.kind.replace("action.", "").replace("approval.", "approval ")} · {item.summary}
                {item.detail ? ` · ${item.detail}` : ""}
              </Line>
            ))
          ) : (
            <Line muted>none</Line>
          )}
        </Section>

        <Section title="Recent actions">
          {recentActionEvents.length ? (
            recentActionEvents.map((event) => (
              <Line key={event.id} tone={event.result === "denied" || event.result === "error" ? "amber" : "cyan"}>
                {event.type.replace("action.", "")} · {event.result} · {event.summary}
              </Line>
            ))
          ) : (
            <Line muted>none</Line>
          )}
        </Section>

        <Section title="Lab health">
          {labHealth.configured ? (
            labHealth.results.map((result) => (
              <Line key={result.id} tone={result.ok ? "cyan" : "amber"}>
                {result.label} · {result.ok ? "ok" : "down"} · {result.status ?? result.error ?? "no response"} · {result.ms}ms
              </Line>
            ))
          ) : (
            <Line muted>not configured</Line>
          )}
        </Section>

        <Section title="Knowledge">
          {liveKnowledge.configured && !liveKnowledge.error ? (
            <Line tone={liveKnowledge.rejected ? "amber" : "cyan"}>
              {liveKnowledge.accepted} typed notes · {liveKnowledge.rejected} need structure · {liveKnowledge.graph.nodes.length} graph nodes
              {latestKnowledgeNote ? ` · latest ${latestKnowledgeNote.summary.replace(/^created /, "")}` : ""}
            </Line>
          ) : (
            <Line muted>{liveKnowledge.error ?? "vault not configured"}</Line>
          )}
        </Section>

        <Section title="What changed">
          {whatChanged.quiet ? (
            <Line muted>all quiet</Line>
          ) : (
            whatChanged.lines.map((line) => <Line key={line} tone={line.startsWith("needs") ? "amber" : "cyan"}>{line}</Line>)
          )}
        </Section>

        <Section title="Approvals">
          {pendingQueuedApprovals.map((approval) => (
            <Line key={approval.id} tone="amber">
              queued · {approval.actionLabel} · {approval.risk} · {approval.plan.target ?? approval.actionId}
              <ApprovalDecisionButtons id={approval.id} />
            </Line>
          ))}
          {decidedQueuedApprovals.map((approval) => {
            const readiness = getExecutionReadiness(approval);
            return (
              <Line key={approval.id} tone={readiness.ready ? "cyan" : "amber"}>
                {approval.status} · {approval.actionLabel} · {approval.risk} · {approval.plan.target ?? approval.actionId} · {readiness.reason}
                {readiness.ready && <ExecuteActionButton actionId={approval.actionId} approvalId={approval.id} />}
              </Line>
            );
          })}
          {approvals.slice(0, 8).map(({ need, action }) => (
            <Line key={`${need.id}:${action.id}`} tone="amber">
              suggested · {action.label} · {action.risk} · {need.title}
              {action.plan?.target ? ` · ${action.plan.target}` : ""}
            </Line>
          ))}
          {!pendingQueuedApprovals.length && !decidedQueuedApprovals.length && !approvals.length && <Line muted>none</Line>}
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

function formatTime(at: number) {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date(at));
}

function statusColor(status: string) {
  if (status === "blocked" || status === "critical") return "text-red-300";
  if (status === "approval" || status === "judgment") return "text-amber-200";
  if (status === "watch" || status === "actionable") return "text-cyan-200";
  return "text-slate-600";
}
