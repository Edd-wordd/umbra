"use client";

import { useDevStore } from "@/lib/dev/store";
import type { DevProject } from "@/lib/dev/projects";
import { STATUS_TONE } from "@/lib/dev/services";
import { runServiceAction } from "./approval";
import { Btn, Dot, SectionHead, Spark, TEXT_TONE } from "./ui";
import { useServiceViews, type ServiceItem } from "./useServiceViews";

function ServiceCard({ item, repo }: { item: ServiceItem; repo: string }) {
  const { adapter, view } = item;
  const detach = useDevStore((s) => s.detachService);
  const tone = STATUS_TONE[view.status];
  return (
    <div className={`@container min-w-0 border-t border-line pt-[8px] ${view.wide ? "col-span-2" : ""}`} data-service={adapter.id}>
      <div className="flex h-[16px] items-center gap-[8px] text-[10px] leading-none">
        <Dot tone={tone} />
        <span className="shrink-0 tracking-[1px] text-ink">{adapter.label}</span>
        <span className={`min-w-0 truncate ${view.status === "ok" || view.status === "idle" ? "text-dim" : TEXT_TONE[tone]}`} title={view.summary}>{view.summary}</span>
        {view.spark && (
          <span className="hidden shrink-0 @[260px]:inline-flex">
            <Spark values={view.spark} tone={tone} width={56} />
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-[2px]">
          {view.actions?.map((a) => (
            <Btn key={a.label} tone="quiet" onClick={() => void runServiceAction(a.toolId, a.args)} title={`${a.label} · ${a.toolId}`}>
              {!view.wide && a.label.endsWith("↗") ? "↗" : a.label}
            </Btn>
          ))}
          <Btn tone="quiet" onClick={() => detach(repo, adapter.id)} title={`detach ${adapter.label} from ${repo}`}>
            ×
          </Btn>
        </span>
      </div>
      <dl className={`mt-[5px] pl-[13px] text-[10px] leading-[17px] ${view.columns === 2 ? "grid grid-cols-2 gap-x-[22px]" : ""}`}>
        {view.rows.map((r, i) => (
          <div key={`${r.k}-${i}`} className="flex min-w-0 gap-[10px]">
            <dt className="w-[78px] shrink-0 truncate text-dim">{r.k}</dt>
            <dd className={`min-w-0 truncate ${r.tone ? TEXT_TONE[r.tone] : "text-mid"}`} title={r.v}>
              {r.v}
            </dd>
          </div>
        ))}
      </dl>
      {view.excerpt && (
        <pre className="relative ml-[13px] mt-[6px] overflow-x-auto border border-line bg-black/35 py-[6px] pl-[12px] pr-[10px] text-[10px] leading-[16px] text-mid">
          <span className="absolute -left-px top-[-1px] bottom-[-1px] w-px bg-broken/70" />
          {view.excerpt.map((l, i) => (
            <div key={i} className={i === 0 ? "text-broken/90" : i === view.excerpt!.length - 1 ? "text-dim" : ""}>
              {l}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

function Drawer({ project }: { project: DevProject }) {
  const items = useServiceViews(project);
  const toggle = useDevStore((s) => s.toggleProject);
  const openPicker = useDevStore((s) => s.openPicker);
  return (
    <section aria-label={`project ${project.repo}`} data-drawer={project.repo} className="umbra-fade-in flex min-h-0 shrink flex-col">
      <SectionHead title={`PROJECT · ${project.repo}`} meta={`${items.length} service${items.length === 1 ? "" : "s"}`}>
        <Btn tone="quiet" onClick={() => openPicker(project.repo)}>
          + SERVICE
        </Btn>
        <Btn tone="quiet" onClick={() => toggle(project.repo)}>
          CLOSE
        </Btn>
      </SectionHead>
      <div className="mt-[6px] grid min-h-0 grid-cols-2 content-start gap-x-[22px] gap-y-[10px] overflow-y-auto pr-[2px]">
        {items.length === 0 && <div className="col-span-2 text-[10px] text-dim">no services attached · + service to add one</div>}
        {items.map((it) => (
          <ServiceCard key={it.adapter.id} item={it} repo={project.repo} />
        ))}
      </div>
    </section>
  );
}

/** Service details for the expanded project, under the terminal. */
export default function ProjectDrawer() {
  const project = useDevStore((s) => s.projects.find((p) => p.repo === s.expandedProject));
  if (!project) return null;
  return <Drawer key={project.repo} project={project} />;
}
