"use client";

import { deriveNeeds, type Need } from "@/lib/dev/needs";
import type { RepoId } from "@/lib/dev/types";
import { useDevStore } from "@/lib/dev/store";
import { approvePending, denyPending, runServiceAction } from "./approval";
import { ApprovalStrip, Btn, SectionHead } from "./ui";
import { Glyph } from "@/components/ui/Glyph";
import { useGlitch } from "@/lib/hooks/useGlitch";
import type { ServiceItem } from "./useServiceViews";

const openProject = (repo: RepoId) => useDevStore.setState({ expandedProject: repo, pickerFor: null });

function Actions({ n }: { n: Need }) {
  const respond = useDevStore((s) => s.respondPrompt);
  const requestKill = useDevStore((s) => s.requestKill);
  const select = useDevStore((s) => s.select);
  const holding = useDevStore((s) => s.pending?.origin === "ports" && s.pending.args?.port === String(n.server?.port));

  switch (n.kind) {
    case "held":
      return (
        <>
          <Btn tone="attention" onClick={() => void approvePending()}>
            YES
          </Btn>
          <Btn onClick={denyPending}>NO</Btn>
        </>
      );
    case "agent-waiting":
      return (
        <>
          <Btn tone="attention" onClick={() => respond(n.agent!.id, "approve")} title={n.agent!.prompt?.detail}>
            YES
          </Btn>
          <Btn onClick={() => respond(n.agent!.id, "deny")}>NO</Btn>
        </>
      );
    case "agent-failed":
      return n.sentryId ? (
        <Btn
          onClick={() => {
            select(n.agent!.sessionId);
            openProject(n.repo!);
          }}
          title={`linked Sentry issue ${n.sentryId} · opens ${n.repo} services`}
        >
          ≈ {n.sentryId}
        </Btn>
      ) : null;
    case "port":
      return holding ? (
        <span className="label text-attention">HELD</span>
      ) : (
        <Btn tone="attention" onClick={() => requestKill(n.server!.port)} title={`kill ${n.server!.pid} · needs your yes`}>
          KILL
        </Btn>
      );
    case "service":
      return n.action ? (
        <Btn tone="quiet" onClick={() => void runServiceAction(n.action!.toolId, n.action!.args)} title={n.action.toolId}>
          {n.action.label}
        </Btn>
      ) : (
        <span className="label px-[4px] text-ghost">›</span>
      );
  }
}

function NeedRow({ n }: { n: Need }) {
  const select = useDevStore((s) => s.select);
  const pending = useDevStore((s) => s.pending);
  const selectedId = useDevStore((s) => s.selectedId);
  const expanded = useDevStore((s) => s.expandedProject);
  const holding = n.kind === "port" && pending?.origin === "ports" && pending.args?.port === String(n.server?.port);
  const active =
    (n.agent && n.agent.sessionId === selectedId) || (n.kind === "service" && n.repo === expanded) || (n.kind === "held" && pending?.sessionId === selectedId);

  const onClick = () => {
    if (n.agent) select(n.agent.sessionId);
    else if (n.kind === "held" && pending?.sessionId) select(pending.sessionId);
    else if (n.kind === "service" && n.repo) openProject(n.repo);
  };

  const glitch = useGlitch<HTMLLIElement>(n.tone);
  const stateCls = n.tone === "broken" ? "text-broken" : "text-attention";
  const detail = n.agent?.failure?.tests[0] ?? n.agent?.prompt?.detail;

  return (
    <li
      data-need={n.kind}
      data-tone={n.tone}
      ref={glitch}
      title={[detail, n.folded.length ? `also: ${n.folded.map((f) => `${f.service} ${f.text}`).join(" · ")}` : ""].filter(Boolean).join("\n") || undefined}
    >
      <div
        onClick={onClick}
        className={`relative flex h-[30px] items-center gap-[10px] px-[12px] transition-colors ${n.kind === "port" ? "" : "cursor-pointer hover:bg-panel-raised"} ${
          active ? "bg-panel-raised" : ""
        }`}
      >
        {active && <span className="absolute inset-y-[6px] left-0 w-[2px] bg-active" />}
        <span className="flex w-[34px] shrink-0">
          <Glyph code={n.code} state={n.tone} />
        </span>
        <span className="label w-[90px] shrink-0 truncate tracking-[0.16em] text-ink">{n.who}</span>
        <span className={`label w-[58px] shrink-0 truncate tracking-[0.16em] ${stateCls}`}>{n.state}</span>
        <span className="min-w-0 truncate text-[10px] text-mid">{n.text}</span>
        <span className="ml-auto flex shrink-0 items-center gap-[5px] pl-[4px]">
          <Actions n={n} />
        </span>
      </div>
      {holding && pending && (
        <div className="px-[12px] pb-[6px] pt-[2px]">
          <ApprovalStrip command={pending.command} reason={pending.reason} onApprove={() => void approvePending()} onDeny={denyPending} />
        </div>
      )}
    </li>
  );
}

/** Top of the Dev view: only what Edward has to act on (usually 0–3 lines). */
export default function NeedsYou({ views }: { views: Record<string, ServiceItem[]> }) {
  const agents = useDevStore((s) => s.agents);
  const servers = useDevStore((s) => s.servers);
  const pending = useDevStore((s) => s.pending);
  const selectedId = useDevStore((s) => s.selectedId);
  const needs = deriveNeeds({ agents, servers, pending, selectedId, views });
  const working = agents.filter((a) => a.state === "running").length;

  return (
    <section aria-label="needs you" className="shrink-0">
      <SectionHead title="NEEDS YOU" meta={needs.length ? String(needs.length).padStart(2, "0") : "00"} />
      {needs.length === 0 ? (
        <div className="mt-[10px] flex h-[30px] items-center gap-[10px]" data-quiet>
          <span className="flex w-[34px] shrink-0">
            <Glyph code="—" state="idle" />
          </span>
          <span className="label w-[90px] shrink-0 tracking-[0.16em] text-ink">ALL QUIET</span>
          <span className="label tracking-[0.16em] text-dim">
            NOTHING NEEDS YOU{working ? ` · ${working} AGENT${working === 1 ? "" : "S"} WORKING` : ""}
          </span>
        </div>
      ) : (
        <ul className="-mx-[12px] mt-[6px]">
          {needs.map((n) => (
            <NeedRow key={n.key} n={n} />
          ))}
        </ul>
      )}
    </section>
  );
}
