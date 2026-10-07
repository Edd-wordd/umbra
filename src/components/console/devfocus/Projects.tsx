"use client";

import { useDevStore } from "@/lib/dev/store";
import { CI_TONE } from "@/lib/dev/format";
import type { AgentSession, LiveProject } from "@/lib/dev/types";
import { agentLabel, gitLong, gitShort, herdrTarget, listeningPort } from "./project";
import { AccentDot, Dot, Jump, LocalLink, SectionHead } from "./ui";

/** "2 agents · 1 working · 1 blocked". Blocked / failed are the only colored words. */
function AgentSummary({ agents }: { agents: AgentSession[] }) {
  if (agents.length === 0) return <span className="text-ghost">no agents</span>;
  const count = (s: AgentSession["state"]) => agents.filter((a) => a.state === s).length;
  const working = count("running");
  const blocked = count("waiting");
  const failed = count("failed");
  return (
    <>
      <span className="text-dim">
        {agents.length} agent{agents.length > 1 ? "s" : ""}
        {working > 0 && ` · ${working} working`}
      </span>
      {blocked > 0 && <span className="text-attention"> · {blocked} blocked</span>}
      {failed > 0 && <span className="text-broken"> · {failed} failed</span>}
    </>
  );
}

function ProjectLine({ p }: { p: LiveProject }) {
  const agents = useDevStore((s) => s.agents).filter((a) => a.repo === p.repo);
  const git = useDevStore((s) => s.git[p.repo]);
  const ci = useDevStore((s) => s.ci[p.repo]);
  const port = useDevStore((s) => listeningPort(s.servers, p.repo));
  const open = useDevStore((s) => s.expandedProject === p.repo);
  const toggle = useDevStore((s) => s.toggleProject);
  const jump = useDevStore((s) => s.jump);
  const target = herdrTarget(agents);
  const short = gitShort(git);
  const dupes = (p.workspaces?.length ?? 0) > 1 ? p.workspaces!.length : 0;

  return (
    <li
      role="button"
      tabIndex={0}
      aria-expanded={open}
      data-project={p.repo}
      onClick={() => toggle(p.repo)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle(p.repo);
        }
      }}
      className={`relative -mx-[8px] flex h-[26px] cursor-pointer items-center gap-[9px] px-[8px] text-[10.5px] leading-none outline-none transition-colors hover:bg-white/[0.02] focus-visible:bg-white/[0.03] ${open ? "bg-white/[0.03]" : ""}`}
    >
      {open && <span className="glow-active absolute left-0 top-[4px] bottom-[4px] w-px bg-active/70" />}
      <AccentDot repo={p.repo} />
      <span className="max-w-[118px] shrink-0 truncate text-ink/90" title={p.path}>
        {p.repo}
        {dupes > 0 && <span className="text-dim"> ×{dupes}</span>}
      </span>
      <span className="min-w-0 flex-1 truncate text-[10px]">
        <AgentSummary agents={agents} />
      </span>
      {short && (
        <span className="shrink-0 text-[10px] tabular-nums text-mid" title={git ? gitLong(git) : undefined}>
          {short}
        </span>
      )}
      {ci && ci.status !== "cancelled" && <Dot tone={CI_TONE[ci.status]} title={`ci ${ci.status} · ${ci.branch} · ${ci.summary}`} />}
      <span className="flex shrink-0 items-center gap-[10px]">
        {target && <Jump label="herdr" title={`focus ${agentLabel(target)} in Herdr`} onClick={() => jump({ kind: "herdr", sessionId: target.sessionId })} />}
        <Jump label="cursor" title={`open ${p.repo} in Cursor`} onClick={() => jump({ kind: "cursor", repo: p.repo })} />
        {port && <LocalLink port={port} />}
      </span>
    </li>
  );
}

/** One line per project (Herdr workspaces grouped by repo). Click a line for its drawer. */
export default function Projects() {
  const projects = useDevStore((s) => s.projects);
  return (
    <section aria-label="projects" data-section="projects">
      <SectionHead title="PROJECTS" />
      {projects.length === 0 ? (
        <p className="mt-[8px] text-[10.5px] text-dim">No Herdr workspaces open.</p>
      ) : (
        <ul className="mt-[6px]">
          {projects.map((p) => (
            <ProjectLine key={p.repo} p={p} />
          ))}
        </ul>
      )}
    </section>
  );
}
