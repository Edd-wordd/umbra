"use client";

import { useState } from "react";
import { useDevStore } from "@/lib/dev/store";
import type { DevProject } from "@/lib/dev/projects";
import { SERVICES, STATUS_TONE, worstStatus, type ServiceStatus } from "@/lib/dev/services";
import type { AgentSession } from "@/lib/dev/types";
import { Btn, Chip, Dot, SectionHead } from "./ui";
import { Glyph } from "@/components/ui/Glyph";
import { useGlitch } from "@/lib/hooks/useGlitch";
import type { ServiceItem } from "./useServiceViews";

function Picker({ project }: { project: DevProject }) {
  const add = useDevStore((s) => s.addService);
  const close = () => useDevStore.getState().openPicker(null);
  const unused = SERVICES.filter((a) => !project.services.includes(a.id));
  const [hover, setHover] = useState(unused[0]?.id);
  const blurb = unused.find((a) => a.id === hover)?.blurb;
  return (
    <div
      className="umbra-pop mb-[4px] ml-[25px] mr-[12px] border-l border-line-strong py-[4px] pl-[10px]"
      data-picker={project.repo}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-[6px] text-[9.5px]">
        <span className="label text-dim">ATTACH</span>
        {unused.length === 0 && <span className="text-ghost">every registered service is attached</span>}
        {unused.map((a) => (
          <span key={a.id} onPointerEnter={() => setHover(a.id)} onFocus={() => setHover(a.id)}>
            <Btn onClick={() => add(project.repo, a.id)} title={a.blurb}>
              + {a.chip} {a.label}
            </Btn>
          </span>
        ))}
        <span className="ml-auto">
          <Btn tone="quiet" onClick={close}>
            ESC
          </Btn>
        </span>
      </div>
      {blurb && <div className="mt-[4px] truncate text-[9.5px] text-dim">{blurb}</div>}
    </div>
  );
}

const AGENT_STATUS: Record<AgentSession["state"], ServiceStatus> = { running: "ok", waiting: "attention", failed: "broken", done: "ok", stopped: "ok" };

function ProjectRow({ project, items }: { project: DevProject; items: ServiceItem[] }) {
  const expanded = useDevStore((s) => s.expandedProject === project.repo);
  const picking = useDevStore((s) => s.pickerFor === project.repo);
  const agents = useDevStore((s) => s.agents);
  const servers = useDevStore((s) => s.servers);
  const toggle = useDevStore((s) => s.toggleProject);
  const openPicker = useDevStore((s) => s.openPicker);
  const select = useDevStore((s) => s.select);

  const mine = agents.filter((a) => a.repo === project.repo);
  const running = mine.filter((a) => a.state === "running");
  const review = mine.find((a) => a.state === "done" && a.diff);
  const flagged = items.filter((i) => i.view.status === "attention" || i.view.status === "broken");
  const activeSvc = items.find((i) => i.view.status === "active");
  const gh = items.find((i) => i.adapter.id === "github");
  // Gray unless something needs him; running work is a white AG tile, not a color change.
  const worst = worstStatus(["ok", ...flagged.map((i) => i.view.status), ...mine.map((a) => AGENT_STATUS[a.state])]);
  const ports = servers.filter((s) => s.repo === project.repo && (s.state === "running" || s.state === "starting"));

  const summary = review?.diff
    ? { text: `+${review.diff.additions} −${review.diff.deletions} review`, cls: "text-mid" }
    : activeSvc
      ? { text: activeSvc.view.summary, cls: "text-ink" }
      : { text: gh?.view.summary ?? items[0]?.view.summary ?? "no services", cls: "text-dim" };
  const glitch = useGlitch<HTMLLIElement>(worst);

  return (
    <li ref={glitch} data-project={project.repo} className="group">
      <div
        onClick={() => toggle(project.repo)}
        aria-expanded={expanded}
        className={`relative flex h-[28px] cursor-pointer items-center gap-[10px] px-[12px] transition-colors ${expanded ? "bg-panel-raised" : "hover:bg-panel-raised"}`}
      >
        {expanded && <span className="absolute inset-y-[6px] left-0 w-[2px] bg-active" />}
        <Dot tone={STATUS_TONE[worst]} />
        <span className={`label w-[118px] shrink-0 truncate tracking-[0.16em] ${worst === "broken" ? "text-broken" : "text-ink"}`}>{project.repo}</span>
        <span className="flex shrink-0 items-center gap-[3px]">
          {items.map(({ adapter, view }) => (
            <Chip
              key={adapter.id}
              label={adapter.chip}
              // Healthy services stay ghost-gray; only attention / broken / running light up.
              tone={view.status === "ok" ? "dim" : STATUS_TONE[view.status]}
              title={`${adapter.label} · ${view.summary}`}
              onClick={() => !expanded && toggle(project.repo)}
            />
          ))}
          {running.map((a) => (
            <Glyph
              key={a.id}
              code="AG"
              state="active"
              title={`${a.agent} running · ${a.task} · open its session`}
              onClick={() => select(a.sessionId)}
              className="ml-[4px]"
            />
          ))}
          {ports.map((s) => (
            <Glyph key={s.id} code={`:${s.port}`} state="active" title={`${s.command} · pid ${s.pid} · open its log`} onClick={() => s.sessionId && select(s.sessionId)} className="ml-[4px]" />
          ))}
        </span>
        <span className={`min-w-0 truncate text-right text-[10px] ${summary.cls} ml-auto`}>{summary.text}</span>
        <button
          type="button"
          aria-label={`add service to ${project.repo}`}
          title="attach a service"
          onClick={(e) => {
            e.stopPropagation();
            openPicker(picking ? null : project.repo);
          }}
          className={`w-[10px] shrink-0 text-[11px] leading-none transition-opacity ${
            picking ? "text-ink opacity-100" : "text-ghost opacity-0 hover:text-mid focus-visible:opacity-100 group-hover:opacity-100"
          }`}
        >
          +
        </button>
      </div>
      {picking && <Picker project={project} />}
    </li>
  );
}

/** One line per project: gray when healthy, a chip only for services that need attention. */
export default function Projects({ views }: { views: Record<string, ServiceItem[]> }) {
  const projects = useDevStore((s) => s.projects);
  return (
    <section aria-label="projects" className="shrink-0">
      <SectionHead title="PROJECTS" meta={String(projects.length).padStart(2, "0")} />
      <ul className="-mx-[12px] mt-[6px]">
        {projects.map((p) => (
          <ProjectRow key={p.repo} project={p} items={views[p.repo] ?? []} />
        ))}
      </ul>
    </section>
  );
}
