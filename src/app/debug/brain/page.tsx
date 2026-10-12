import { parseObsidianNote, indexObsidianNotes } from "@/lib/knowledge";
import DebugScrollRoot from "./DebugScrollRoot";
import KnowledgeVaultPanel from "./KnowledgeVaultPanel";
import { runArchitectureChecks } from "@/lib/architecture";
import { buildBrainViewModel, buildGraphExamples } from "@/lib/brain";
import { routeCommandSamples } from "@/lib/commands";
import { DOMAIN_ADAPTERS, DOMAIN_READINESS, createSampleMultiDomainBrain } from "@/lib/domain";
import { buildOpsNeeds, buildWhatChanged, localTriageOpsNeeds } from "@/lib/ops";

export default async function BrainDebugPage() {
  const now = 1_700_000_000_000;
  const brain = createSampleMultiDomainBrain(now);
  const needs = await buildOpsNeeds(brain);
  const viewModel = buildBrainViewModel(brain);
  const graphExamples = buildGraphExamples(brain.graph);
  const architectureChecks = await runArchitectureChecks({ graph: brain.graph, situations: brain.situations });
  const commandRoutes = await routeCommandSamples([
    "open Proxmox",
    "restart Immich",
    "show what changed since I left",
    "send follow-up to the lead",
    "check astro gear",
  ]);
  const triage = localTriageOpsNeeds(needs);
  const triageByNeed = new Map(triage.map((decision) => [decision.needId, decision]));
  const whatChanged = buildWhatChanged({ since: now - 60 * 60_000, generatedAt: now, needs, memory: brain.memory });
  const obsidian = indexObsidianNotes([
    parseObsidianNote(
      "umbra",
      "40_Runbooks/Dev/Stale Port Recovery.md",
      `---
type: runbook
umbra_id: runbook:dev:stale-port
domain: dev
status: active
risk: local-risky
related_projects:
  - project:umbra
---
# Stale Port Recovery

Recover a local dev server blocked by an orphaned process.
`,
    ),
    parseObsidianNote(
      "umbra",
      "50_Decisions/Obsidian Authoring Layer.md",
      `---
type: decision
umbra_id: decision:knowledge:obsidian-authoring-layer
domain: knowledge
status: accepted
affects:
  - project:umbra
---
# Obsidian is the authoring layer

Umbra's typed graph is the machine memory layer.
`,
    ),
    parseObsidianNote("umbra", "00_Inbox/Loose thought.md", "# Loose thought\n\nNo frontmatter yet."),
  ], now);

  return (
    <DebugScrollRoot>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="border border-cyan-400/20 bg-black/30 p-5">
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-300/70">Umbra debug</p>
          <h1 className="mt-2 text-2xl font-light tracking-[0.2em] text-cyan-100">Brain / Ops pipeline</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Sample Dev state → typed graph → situations → runbooks/actions → dry-run plans → memory. This route is an inspection surface, not final UI.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="nodes" value={brain.graph.nodes.length} />
          <Metric label="edges" value={brain.graph.edges.length} />
          <Metric label="situations" value={brain.situations.length} />
          <Metric label="ops needs" value={needs.length} />
          <Metric label="adapters" value={brain.adapterResults.length} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Domain adapters">
            <ul className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              {DOMAIN_ADAPTERS.map((adapter) => (
                <li key={adapter.id} className="flex justify-between border border-white/10 px-3 py-2">
                  <span>{adapter.label}</span>
                  <span className={adapter.id === "dev" ? "text-cyan-200" : "text-slate-600"}>{adapter.id === "dev" ? "active" : "stub"}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Domain summary">
            <pre className="overflow-auto text-xs text-slate-300">{JSON.stringify(brain.domains, null, 2)}</pre>
          </Panel>
          <Panel title="Real Obsidian vault">
            <KnowledgeVaultPanel />
          </Panel>
          <Panel title="Obsidian index sample">
            <div className="space-y-2 text-sm">
              <p>accepted: <span className="text-cyan-200">{obsidian.accepted.length}</span></p>
              <p>rejected: <span className="text-amber-200">{obsidian.rejected.length}</span></p>
              <p>graph: <span className="text-cyan-200">{obsidian.graph.nodes.length} nodes / {obsidian.graph.edges.length} edges</span></p>
              {obsidian.rejected.map(({ note, reason }) => (
                <p key={note.path} className="text-amber-300/80">skipped {note.path}: {reason}</p>
              ))}
            </div>
          </Panel>
        </section>

        <Panel title="Rail readiness">
          <div className="overflow-auto">
            <table className="w-full min-w-[820px] text-left text-xs text-slate-300">
              <thead className="text-slate-500">
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-3 font-normal uppercase tracking-[0.2em]">rail</th>
                  <th className="py-2 pr-3 font-normal uppercase tracking-[0.2em]">audit</th>
                  <th className="py-2 pr-3 font-normal uppercase tracking-[0.2em]">adapter</th>
                  <th className="py-2 pr-3 font-normal uppercase tracking-[0.2em]">actions</th>
                  <th className="py-2 pr-3 font-normal uppercase tracking-[0.2em]">runbooks</th>
                  <th className="py-2 pr-3 font-normal uppercase tracking-[0.2em]">bridge</th>
                  <th className="py-2 font-normal uppercase tracking-[0.2em]">notes</th>
                </tr>
              </thead>
              <tbody>
                {DOMAIN_READINESS.map((rail) => (
                  <tr key={rail.id} className="border-b border-white/5 align-top">
                    <td className="py-2 pr-3 text-cyan-100">{rail.label}</td>
                    <td className="py-2 pr-3"><Readiness value={rail.audit} /></td>
                    <td className="py-2 pr-3"><Readiness value={rail.adapter} /></td>
                    <td className="py-2 pr-3"><Readiness value={rail.actions} /></td>
                    <td className="py-2 pr-3"><Readiness value={rail.runbooks} /></td>
                    <td className="py-2 pr-3"><Readiness value={rail.bridge} /></td>
                    <td className="py-2 text-slate-500">{rail.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Visual brain model">
          <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-2 lg:grid-cols-4">
            {viewModel.sectors.map((sector) => (
              <div key={sector.domain} className="border border-white/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="uppercase tracking-[0.25em] text-slate-500">{sector.domain}</span>
                  <span className={sector.status === "blocked" || sector.status === "critical" ? "text-red-300" : sector.status === "approval" || sector.status === "judgment" ? "text-amber-200" : sector.status === "actionable" || sector.status === "watch" ? "text-cyan-200" : "text-slate-600"}>{sector.status}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{sector.total} nodes · {sector.attention} attention · {sector.situations.length} situations</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Architecture checks">
          <ul className="space-y-2 text-sm text-slate-300">
            {architectureChecks.map((check) => (
              <li key={check.id} className="flex flex-wrap justify-between gap-3 border border-white/10 px-3 py-2">
                <span>{check.label}</span>
                <span className={check.status === "pass" ? "text-cyan-200" : check.status === "warn" ? "text-amber-200" : "text-red-300"}>{check.status}</span>
                <span className="w-full text-xs text-slate-500">{check.detail}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Command routing samples">
          <ul className="space-y-3 text-sm text-slate-300">
            {commandRoutes.map((route) => (
              <li key={route.input} className="border-l border-cyan-400/30 pl-3">
                <p><span className="text-cyan-200">“{route.input}”</span> → {route.actionId ?? "unresolved"}</p>
                <p className="mt-1 text-slate-500">
                  {route.source} · confidence {route.confidence.toFixed(2)} · {route.requiresApproval ? "approval required" : "no approval"} · {route.reason}
                </p>
                {route.plan && <p className="mt-1 text-slate-600">{route.plan.summary}{route.plan.target ? ` → ${route.plan.target}` : ""}</p>}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Graph traversals">
          <ul className="space-y-3 text-sm text-slate-300">
            {graphExamples.map((item) => (
              <li key={item.id} className="border-l border-cyan-400/30 pl-3">
                <p><span className={item.path ? "text-cyan-200" : "text-amber-200"}>{item.title}</span></p>
                <p className="mt-1 text-slate-500">{item.summary}</p>
              </li>
            ))}
          </ul>
        </Panel>

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

        <Panel title="Needs Edward">
          <div className="space-y-4">
            {needs.map((need) => (
              <article key={need.id} className="border border-white/10 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{need.severity}</p>
                    <h2 className="mt-1 text-lg text-cyan-100">{need.title}</h2>
                    <p className="mt-2 text-sm text-amber-100/80">why now: {need.whyNow}</p>
                  </div>
                  <div className="space-y-2 text-right">
                    <p className="text-xs text-slate-500">{need.entities.length} entities · {need.memory.length} memory</p>
                    {triageByNeed.get(need.id) && (
                      <p className="text-xs text-slate-500">
                        triage: <span className="text-cyan-200">{triageByNeed.get(need.id)?.source}</span>
                        <span className="text-slate-700"> · </span>
                        {triageByNeed.get(need.id)?.category}
                        <span className="text-slate-700"> · </span>
                        priority {triageByNeed.get(need.id)?.priority.toFixed(2)}
                        <span className="text-slate-700"> · </span>
                        {triageByNeed.get(need.id)?.reason}
                      </p>
                    )}
                  </div>
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
                    <h3 className="text-xs uppercase tracking-[0.25em] text-slate-500">Actions / dry runs</h3>
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
            ))}
          </div>
        </Panel>

        <Panel title="Memory sample">
          <ul className="space-y-1 text-xs text-slate-400">
            {brain.memory.slice(0, 12).map((event) => (
              <li key={event.id}><span className="text-slate-600">{event.type}</span> · {event.summary}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </DebugScrollRoot>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-white/10 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-light text-cyan-100">{value}</p>
    </div>
  );
}

function Readiness({ value }: { value: string }) {
  const color = value === "active" ? "text-cyan-200" : value === "partial" ? "text-amber-200" : value === "deferred" ? "text-slate-700" : "text-slate-500";
  return <span className={color}>{value}</span>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-white/10 bg-black/30 p-4">
      <h2 className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300/70">{title}</h2>
      {children}
    </section>
  );
}
