import { parseObsidianNote, indexObsidianNotes } from "@/lib/knowledge";
import { createSampleBrain } from "@/lib/brain";
import { buildOpsNeeds, buildWhatChanged } from "@/lib/ops";

export default async function BrainDebugPage() {
  const now = 1_700_000_000_000;
  const brain = createSampleBrain(now);
  const needs = await buildOpsNeeds(brain);
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
    <main className="h-screen overflow-y-auto bg-[#050607] p-8 text-[#d7e4e8]">
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
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Domain summary">
            <pre className="overflow-auto text-xs text-slate-300">{JSON.stringify(brain.domains, null, 2)}</pre>
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

        <Panel title="What changed since I left?">
          {whatChanged.quiet ? (
            <p className="text-sm text-slate-500">all quiet</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-300">
              {whatChanged.items.map((item) => (
                <li key={item.id} className="border-l border-cyan-400/30 pl-3">
                  <span className={item.severity === "attention" ? "text-amber-200" : "text-cyan-200"}>{item.kind}</span>
                  <span className="text-slate-600"> · </span>
                  {item.summary}
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
                  <p className="text-xs text-slate-500">{need.entities.length} entities · {need.memory.length} memory</p>
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
    </main>
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-white/10 bg-black/30 p-4">
      <h2 className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300/70">{title}</h2>
      {children}
    </section>
  );
}
