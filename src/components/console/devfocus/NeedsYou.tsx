"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTriageStore } from "@/lib/decide/store";
import { TRIAGE_POLICY, type TriageDecision } from "@/lib/decide/triage";
import { deriveNeeds, type Need } from "@/lib/dev/needs";
import { signalsFromNeeds, type DevSignal } from "@/lib/dev/signals";
import type { RepoId } from "@/lib/dev/types";
import { accentOf } from "@/lib/dev/colors";
import { useDevStore } from "@/lib/dev/store";
import { approvePending, denyPending, runServiceAction } from "./approval";
import { ApprovalStrip, Btn, Dot, SectionHead } from "./ui";
import type { ServiceItem } from "./useServiceViews";

const openProject = (repo: RepoId) => useDevStore.setState({ expandedProject: repo, pickerFor: null });

/* --- actions --------------------------------------------------------------- */

function NeedActions({ n }: { n: Need }) {
  const respond = useDevStore((s) => s.respondPrompt);
  const requestKill = useDevStore((s) => s.requestKill);
  const select = useDevStore((s) => s.select);
  const jump = useDevStore((s) => s.jump);
  const live = useDevStore((s) => s.bridgeMode === "live");
  const holding = useDevStore((s) => s.pending?.origin === "ports" && s.pending.args?.port === String(n.server?.port));

  switch (n.kind) {
    case "held":
      return (
        <>
          <Btn tone="attention" onClick={() => void approvePending()}>
            APPROVE
          </Btn>
          <Btn onClick={denyPending}>DENY</Btn>
        </>
      );
    case "agent-waiting":
      return (
        <>
          <Btn tone="attention" onClick={() => respond(n.agent!.id, "approve")} title={n.agent!.prompt?.detail}>
            APPROVE
          </Btn>
          <Btn onClick={() => respond(n.agent!.id, "deny")}>DENY</Btn>
          {live && n.agent!.sessionId.startsWith("pane:") && (
            <Btn tone="quiet" onClick={() => jump({ kind: "herdr", sessionId: n.agent!.sessionId })} title="answer it in Herdr (terminal to the front)">
              HERDR ↗
            </Btn>
          )}
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
        <span className="text-[9.5px] tracking-[1px] text-attention">HELD</span>
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
        <span className="px-[4px] text-[10px] text-ghost">›</span>
      );
  }
}

/** Streamed event: a one-action fix (only when Jev thinks Umbra can self-fix it) + dismiss. */
function SignalActions({ s, d }: { s: DevSignal; d?: TriageDecision }) {
  const holding = useDevStore((st) => st.pending?.signalId === s.id);
  const busy = useDevStore((st) => !!st.pending);
  const dismiss = useDevStore((st) => st.dismissSignal);
  const fixable = s.fix && d && d.selfFix >= 0.6;
  const holdFix = () => {
    if (!s.fix || busy) return;
    const args = s.fix.args ?? {};
    useDevStore.setState({
      pending: {
        id: `fix-${s.id}`,
        origin: "fix",
        signalId: s.id,
        command: `${s.fix.toolId} ${Object.values(args).join(" ")}`.trim(),
        reason: `one-action fix · ${d!.source} self-fix ${Math.round(d!.selfFix * 100)}% · sample`,
        source: "touch",
        toolId: s.fix.toolId,
        args,
      },
    });
    useDevStore.getState().log("touch", `${s.fix.label.toLowerCase()} ${s.repo ?? s.source} held · needs your yes`, "pending");
  };
  return (
    <>
      {fixable &&
        (holding ? (
          <span className="text-[9.5px] tracking-[1px] text-attention">HELD</span>
        ) : (
          <Btn tone="quiet" onClick={holdFix} title={`${s.fix!.toolId} · Umbra can likely fix this itself · needs your yes`}>
            {s.fix!.label}
          </Btn>
        ))}
      <button
        type="button"
        aria-label="dismiss"
        title="dismiss"
        onClick={(e) => {
          e.stopPropagation();
          dismiss(s.id);
        }}
        className="px-[3px] text-[10px] text-ghost hover:text-mid"
      >
        ✕
      </button>
    </>
  );
}

/* --- rows -------------------------------------------------------------------- */

interface Row {
  key: string;
  need?: Need;
  signal?: DevSignal;
  decision?: TriageDecision;
  /** Decision not back yet (shown: lean toward visible). */
  deciding?: boolean;
  priority: number;
}

/** Tiny hover reason: "jev · urgent 4/5 · 83%" (CSS hover, so it also shows in screenshots). */
function Reason({ d, deciding, pinned }: { d?: TriageDecision; deciding?: boolean; pinned?: boolean }) {
  const text = pinned ? "pinned · your held command" : deciding ? "deciding…" : d?.reason;
  if (!text) return null;
  return (
    <span
      role="tooltip"
      data-reason
      className="pointer-events-none absolute right-[10px] top-[calc(100%-3px)] z-30 hidden whitespace-nowrap border border-line-strong bg-panel px-[6px] py-[3px] text-[9px] leading-[13px] text-mid shadow-[0_4px_14px_rgba(0,0,0,0.5)] [.group:hover>&]:block"
    >
      <span className="text-ink">{text}</span>
      {d && (
        <span className="block text-dim">
          {d.category} · attention {Math.round(d.attention * 100)}% · self-fix {Math.round(d.selfFix * 100)}%
          {d.rule ? ` · ${d.rule}` : ""}
          {d.source === "local" && d.fallback ? ` · ${d.fallback}` : ""}
        </span>
      )}
    </span>
  );
}

function RowView({ row }: { row: Row }) {
  const select = useDevStore((s) => s.select);
  const pending = useDevStore((s) => s.pending);
  const selectedId = useDevStore((s) => s.selectedId);
  const expanded = useDevStore((s) => s.expandedProject);
  const { need: n, signal: s, decision: d } = row;

  const tone = n?.tone ?? (s?.tone === "info" ? "attention" : (s?.tone ?? "attention"));
  const who = n?.who ?? s?.repo ?? (s?.kind === "lead.new" ? "deadbridge" : (s?.source ?? ""));
  const text = n?.text ?? s?.title ?? "";
  const repo = n?.repo ?? s?.repo;
  const holding =
    (n?.kind === "port" && pending?.origin === "ports" && pending.args?.port === String(n.server?.port)) || (!!s && !n && pending?.signalId === s.id);
  const active =
    (n?.agent && n.agent.sessionId === selectedId) ||
    ((n?.kind === "service" || (!n && s)) && !!repo && repo === expanded) ||
    (n?.kind === "held" && pending?.sessionId === selectedId);
  const clickable = !(n?.kind === "port") && !!(n?.agent || n?.kind === "held" || repo);

  const onClick = () => {
    if (n?.agent) select(n.agent.sessionId);
    else if (n?.kind === "held" && pending?.sessionId) select(pending.sessionId);
    else if (repo) openProject(repo);
  };

  return (
    <li
      data-need={n?.kind ?? "signal"}
      data-signal={s?.kind}
      data-tone={tone}
      data-source={d?.source}
      data-unsure={d?.unsure || undefined}
      className="group relative"
      title={n?.folded.length ? `also: ${n.folded.map((f) => `${f.service} ${f.text}`).join(" · ")}` : undefined}
    >
      <div
        onClick={onClick}
        className={`relative flex h-[30px] items-center gap-[8px] px-[12px] text-[10.5px] transition-colors ${
          clickable ? "cursor-pointer" : ""
        } hover:bg-panel-raised/50 ${active ? "bg-panel-raised" : ""}`}
      >
        {active && <span className="absolute inset-y-[5px] left-0 w-[2px] bg-mid" />}
        <Dot tone={tone} pulse={false} />
        <span className="w-[92px] shrink-0 truncate text-ink" style={repo ? { color: accentOf(repo).hex } : undefined}>
          {who}
        </span>
        {d?.unsure && (
          <span className="-mx-[2px] shrink-0 text-[9px] text-attention/70" title="unsure · shown to be safe">
            ?
          </span>
        )}
        <span className={`min-w-0 truncate ${row.deciding ? "text-dim" : "text-mid"}`}>{text}</span>
        <span className="ml-auto flex shrink-0 items-center gap-[6px]">
          {row.deciding && <span className="text-[9px] text-ghost">…</span>}
          {n ? <NeedActions n={n} /> : s ? <SignalActions s={s} d={d} /> : null}
        </span>
      </div>
      <Reason d={d} deciding={row.deciding} pinned={n?.kind === "held"} />
      {n?.kind === "agent-waiting" && n.agent?.prompt?.detail.includes("\n") && (
        // Live (Herdr): the last lines of the agent's screen, so he sees what he's approving.
        <pre
          data-prompt-excerpt={n.agent.id}
          onClick={onClick}
          className="relative mb-[4px] ml-[25px] mr-[12px] cursor-pointer overflow-hidden border border-line bg-black/35 py-[5px] pl-[10px] pr-[8px] text-[9.5px] leading-[15px] text-dim"
        >
          <span className="absolute -left-px top-[-1px] bottom-[-1px] w-px bg-attention/70" />
          {n.agent.prompt.detail
            .split("\n")
            .slice(-5)
            .map((l, i, all) => (
              <div key={i} className={`truncate ${i === all.length - 1 ? "text-attention/90" : ""}`}>
                {l || " "}
              </div>
            ))}
        </pre>
      )}
      {holding && pending && (
        <div className="px-[12px] pb-[6px] pt-[2px]">
          <ApprovalStrip command={pending.command} reason={pending.reason} onApprove={() => void approvePending()} onDeny={denyPending} />
        </div>
      )}
    </li>
  );
}

const PENDING_PRIORITY = { broken: 0.7, attention: 0.5, info: 0.3 } as const;

/**
 * Top of the Dev view: only what Edward has to act on. Every candidate
 * (derived needs + streamed events) goes through the decision layer; this
 * shows the "needs-you" placements, highest priority first, max 3 + more.
 */
export default function NeedsYou({ views }: { views: Record<string, ServiceItem[]> }) {
  const agents = useDevStore((s) => s.agents);
  const servers = useDevStore((s) => s.servers);
  const pending = useDevStore((s) => s.pending);
  const selectedId = useDevStore((s) => s.selectedId);
  const streamed = useDevStore((s) => s.signals);
  const decisions = useTriageStore((s) => s.decisions);
  const request = useTriageStore((s) => s.request);
  const [more, setMore] = useState(false);

  const needs = useMemo(() => deriveNeeds({ agents, servers, pending, selectedId, views }), [agents, servers, pending, selectedId, views]);
  const signals = useMemo(() => [...streamed, ...signalsFromNeeds(needs)], [streamed, needs]);
  // Idempotent: only unseen signal ids are sent; repeated calls are no-ops.
  useEffect(() => request(signals), [request, signals]);

  const needByKey = new Map(needs.map((n) => [n.key, n]));
  const rows: Row[] = needs.filter((n) => n.kind === "held").map((n) => ({ key: n.key, need: n, priority: 2 }));
  let routed = 0;
  for (const s of signals) {
    const d = decisions[s.id];
    const need = s.needKey ? needByKey.get(s.needKey) : undefined;
    if (d) {
      if (d.placement === "needs-you") rows.push({ key: s.id, need, signal: s, decision: d, priority: d.priority + (d.rule === "blocked on you" ? 1 : 0) });
      else routed++;
    } else if (s.tone !== "info") {
      // Not decided yet: lean toward showing anything the source flagged.
      rows.push({ key: s.id, need, signal: s, deciding: true, priority: PENDING_PRIORITY[s.tone] });
    }
  }
  rows.sort((a, b) => b.priority - a.priority);
  const shown = more ? rows : rows.slice(0, TRIAGE_POLICY.maxShown);
  const hidden = rows.length - shown.length;
  const working = agents.filter((a) => a.state === "running").length;
  const sources = [...new Set(rows.flatMap((r) => (r.decision ? [r.decision.source] : [])))];
  const meta: ReactNode = rows.length ? (
    <>
      {rows.length}
      {sources.length > 0 && <span className="text-ghost"> · {sources.join("+")}</span>}
      {routed > 0 && <span className="text-ghost"> · {routed} routed</span>}
    </>
  ) : undefined;

  return (
    <section aria-label="needs you" className="shrink-0">
      <SectionHead title="NEEDS YOU" meta={meta} />
      {rows.length === 0 ? (
        <div className="mt-[8px] flex h-[30px] items-center gap-[10px] text-[10.5px]" data-quiet>
          <Dot tone="mid" />
          <span className="text-mid">all quiet</span>
          <span className="text-dim">
            · nothing needs you{working ? ` · ${working} agent${working === 1 ? "" : "s"} working` : ""}
            {routed ? ` · ${routed} triaged away` : ""}
          </span>
        </div>
      ) : (
        <ul className="-mx-[12px] mt-[6px]">
          {shown.map((r) => (
            <RowView key={r.key} row={r} />
          ))}
          {(hidden > 0 || more) && rows.length > TRIAGE_POLICY.maxShown && (
            <li>
              <button
                type="button"
                data-more
                onClick={() => setMore(!more)}
                className="flex h-[22px] w-full items-center px-[12px] pl-[25px] text-[9.5px] tracking-[1px] text-dim hover:text-mid"
              >
                {more ? "− fewer" : `+${hidden} more`}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
