"use client";

import type { ReactNode } from "react";
import { useDevStore } from "@/lib/dev/store";
import { AGENT_TONE, AGENT_WORD, CI_TONE, formatAge } from "@/lib/dev/format";
import type { AgentSession } from "@/lib/dev/types";
import { useMinuteClock } from "@/lib/hooks/useClock";
import { agentLabel, gitLong, isListening } from "./project";
import { AccentDot, Dot, Jump, LocalLink, SectionHead, TEXT_TONE } from "./ui";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-[10px]">
      <SectionHead title={title} />
      <div className="mt-[6px] text-[10.5px] leading-[20px]">{children}</div>
    </div>
  );
}

function AgentRow({ a }: { a: AgentSession }) {
  const jump = useDevStore((s) => s.jump);
  const tone = AGENT_TONE[a.state];
  return (
    <div className="flex min-w-0 items-center gap-[9px]" data-agent={a.id}>
      <Dot tone={tone} />
      <span className="w-[92px] shrink-0 truncate text-ink/90">{agentLabel(a)}</span>
      <span className={`w-[52px] shrink-0 ${a.state === "waiting" || a.state === "failed" ? TEXT_TONE[tone] : "text-dim"}`}>{AGENT_WORD[a.state]}</span>
      <span className="min-w-0 flex-1 truncate text-mid" title={a.prompt?.title ?? a.task}>
        {a.state === "waiting" && a.prompt?.title ? <span className="text-attention/80">{a.prompt.title}</span> : a.task || <span className="text-ghost">no title</span>}
      </span>
      <Jump label="herdr" title={`focus ${agentLabel(a)} in Herdr`} onClick={() => jump({ kind: "herdr", sessionId: a.sessionId })} />
    </div>
  );
}

/** A little more about one project: its agents, git and ports. Read-only apart from jumps. */
export default function ProjectDrawer() {
  const repo = useDevStore((s) => s.expandedProject);
  const project = useDevStore((s) => s.projects.find((p) => p.repo === repo));
  const all = useDevStore((s) => s.agents);
  const git = useDevStore((s) => (repo ? s.git[repo] : undefined));
  const ci = useDevStore((s) => (repo ? s.ci[repo] : undefined));
  const servers = useDevStore((s) => s.servers).filter((x) => x.repo === repo && x.state !== "stopped" && x.state !== "free");
  const toggle = useDevStore((s) => s.toggleProject);
  const jump = useDevStore((s) => s.jump);
  const now = useMinuteClock()?.getTime();
  if (!repo || !project) return null;
  const agents = all.filter((a) => a.repo === repo);

  return (
    <div className="flex min-h-0 flex-col gap-[14px] overflow-y-auto" data-drawer={repo}>
      <div className="flex h-[16px] items-center gap-[10px] text-[11px] leading-none">
        <AccentDot repo={repo} />
        <span className="tracking-[1px] text-ink">{repo}</span>
        <span className="min-w-0 flex-1 truncate text-[9.5px] text-dim" title={project.path}>
          {project.path}
        </span>
        <Jump label="cursor" title={`open ${repo} in Cursor`} onClick={() => jump({ kind: "cursor", repo })} />
        <button type="button" onClick={() => toggle(repo)} className="shrink-0 text-[10px] text-dim hover:text-ink" aria-label="close project">
          ✕
        </button>
      </div>

      <Block title="AGENTS">{agents.length ? agents.map((a) => <AgentRow key={a.id} a={a} />) : <span className="text-dim">No agents in its Herdr workspaces.</span>}</Block>

      <Block title="GIT">
        {git ? (
          <>
            <div className="flex min-w-0 gap-[10px]">
              <span className="text-ink/90">{git.branch}</span>
              <span className={git.uncommitted || git.ahead ? "text-mid" : "text-dim"}>{gitLong(git)}</span>
              {!git.remote && <span className="text-dim">· no remote</span>}
            </div>
            {git.staleBranches.length > 0 && (
              <div className="truncate text-dim" title={git.staleBranches.map((b) => `${b.name} · ${b.days}d`).join("\n")}>
                stale · {git.staleBranches.map((b) => `${b.name} ${b.days}d`).join(" · ")}
              </div>
            )}
          </>
        ) : (
          <span className="text-dim">reading…</span>
        )}
        {ci && (
          <div className="flex min-w-0 items-center gap-[9px]">
            <Dot tone={CI_TONE[ci.status]} />
            <span className={`shrink-0 ${ci.status === "failed" ? "text-broken" : "text-dim"}`}>ci {ci.status}</span>
            <span className="min-w-0 flex-1 truncate text-mid">
              {ci.branch} · {ci.summary}
            </span>
            {now && <span className="shrink-0 text-dim">{formatAge(now - ci.at)}</span>}
            {ci.url && (
              <a href={ci.url} target="_blank" rel="noreferrer" className="shrink-0 text-[9.5px] text-dim hover:text-active">
                github ↗
              </a>
            )}
          </div>
        )}
      </Block>

      <Block title="PORTS">
        {servers.length ? (
          servers.map((x) => (
            <div key={x.id} className="flex min-w-0 items-center gap-[9px]">
              <Dot tone={x.state === "running" ? "active" : "dim"} />
              <span className="w-[44px] shrink-0 tabular-nums text-ink/90">:{x.port}</span>
              <span className="min-w-0 flex-1 truncate text-dim" title={x.note ? `${x.command}\n${x.note}` : x.command}>
                {x.command}
              </span>
              {x.state !== "running" && <span className="shrink-0 text-dim">{x.state === "stale" ? "orphan" : x.state}</span>}
              {isListening(x) && <LocalLink port={x.port} />}
            </div>
          ))
        ) : (
          <span className="text-dim">Nothing listening.</span>
        )}
      </Block>
    </div>
  );
}
