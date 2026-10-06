"use client";

import { SERVER_TONE } from "@/lib/dev/format";
import { useDevStore } from "@/lib/dev/store";
import type { DockerPayload } from "@/lib/dev/services/docker";
import type { DevServer } from "@/lib/dev/types";
import { approvePending, denyPending } from "./approval";
import { ApprovalStrip, Btn, Dot, SectionHead, TEXT_TONE } from "./ui";

function ServerRow({ s, selected }: { s: DevServer; selected: boolean }) {
  const select = useDevStore((st) => st.select);
  const requestKill = useDevStore((st) => st.requestKill);
  const start = useDevStore((st) => st.startServer);
  const pending = useDevStore((st) => st.pending);
  const tone = SERVER_TONE[s.state];
  const holding = pending?.origin === "ports" && pending.args?.port === String(s.port);
  // Containers tied to this project sit next to its dev server (only if the project uses docker).
  const usesDocker = useDevStore((st) => !!s.repo && !!st.projects.find((p) => p.repo === s.repo)?.services.includes("docker"));
  const dockerPayload = useDevStore((st) => (s.repo ? st.services.docker?.[s.repo] : undefined)) as DockerPayload | undefined;
  const containers = usesDocker ? dockerPayload?.containers ?? [] : [];

  const label =
    s.state === "stale" ? "STALE" : s.state === "free" ? "FREE" : s.state === "starting" ? "STARTING" : s.state.toUpperCase();
  const who = s.repo ?? (s.state === "free" ? "—" : `pid ${s.pid}`);
  const what = s.repo ? (s.state === "stopped" ? s.command : `${s.command} · pid ${s.pid}`) : s.state === "stale" ? `${s.command} · orphan` : "";

  return (
    <li data-port={s.port}>
      <div
        onClick={() => s.sessionId && select(s.sessionId)}
        className={`relative flex h-[28px] items-center gap-[8px] px-[12px] text-[10.5px] ${s.sessionId ? "cursor-pointer hover:bg-panel-raised/50" : ""} ${
          selected ? "bg-panel-raised" : ""
        }`}
      >
        {selected && <span className="absolute inset-y-[4px] left-0 w-[2px] bg-mid" />}
        <Dot tone={tone} pulse={s.state === "starting"} />
        <span className={`w-[40px] shrink-0 tabular-nums ${s.state === "free" || s.state === "stopped" ? "text-dim" : "text-ink"}`}>:{s.port}</span>
        <span className="shrink-0 text-ink">{who}</span>
        <span className="min-w-0 truncate text-dim">{what}</span>
        <span className="ml-auto flex shrink-0 items-center gap-[8px]">
          {s.state === "stale" && !holding && (
            <>
              <span className="text-[10px] text-attention">{s.note}</span>
              <Btn tone="attention" onClick={() => requestKill(s.port)}>
                KILL
              </Btn>
            </>
          )}
          {s.state === "stopped" && <Btn onClick={() => start(s.id)}>START</Btn>}
          {(s.state === "running" || s.state === "starting" || s.state === "free" || holding) && (
            <span className={`text-[9.5px] tracking-[1px] ${holding ? "text-attention" : TEXT_TONE[tone]}`}>{holding ? "HELD" : label}</span>
          )}
        </span>
      </div>
      {containers.length > 0 && (
        <div className="flex h-[18px] items-center gap-[10px] pl-[73px] pr-[12px] text-[9.5px] text-dim" data-containers={s.repo}>
          <span className="text-ghost">docker</span>
          {containers.map((c) => (
            <span key={c.name} className={`flex items-center gap-[4px] ${c.state === "running" ? "" : c.state === "restarting" ? "text-attention" : "text-broken"}`}>
              <span className={`h-[3px] w-[3px] rounded-full ${c.state === "running" ? "bg-mid" : c.state === "restarting" ? "bg-attention" : "bg-broken"}`} />
              {c.name}
            </span>
          ))}
        </div>
      )}
      {holding && pending && (
        <div className="px-[12px] pb-[6px] pt-[2px]">
          <ApprovalStrip command={pending.command} reason={pending.reason} onApprove={() => void approvePending()} onDeny={denyPending} />
        </div>
      )}
    </li>
  );
}

/** Dev servers + who holds which port. */
export default function Servers() {
  const servers = useDevStore((s) => s.servers);
  const selectedId = useDevStore((s) => s.selectedId);
  const running = servers.filter((s) => s.state === "running").length;
  return (
    <section aria-label="dev servers" className="shrink-0">
      <SectionHead title="DEV SERVERS · PORTS" meta={`${running} running · lsof via mac helper`} />
      <ul className="-mx-[12px] mt-[6px]">
        {servers.map((s) => (
          <ServerRow key={s.id} s={s} selected={!!s.sessionId && s.sessionId === selectedId} />
        ))}
      </ul>
    </section>
  );
}
