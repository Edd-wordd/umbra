"use client";

import { useEffect, useRef, useState } from "react";
import VoiceMicrophone from "./VoiceMicrophone";
import { useRouter } from "next/navigation";
import { useUmbra } from "@/lib/store";
import { RAIL_NAVIGATION, OPS_NAVIGATION } from "@/lib/commands/navigation";

type VoiceRoute = {
  transcript: string;
  spokenSummary: string;
  route?: { actionId?: string; confidence: number; unresolved?: boolean; requiresApproval?: boolean };
};

export default function VoiceCommandPreview({ active, contextNodeId, contextLabel }: { active: boolean; contextNodeId?: string | null; contextLabel?: string | null }) {
  return active ? <VoiceSession key={contextNodeId ?? "none"} contextNodeId={contextNodeId} contextLabel={contextLabel} /> : null;
}

function VoiceSession({ contextNodeId, contextLabel }: { contextNodeId?: string | null; contextLabel?: string | null }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<VoiceRoute | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [spoken, setSpoken] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  useEffect(() => () => {
    sequence.current += 1;
    pending.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  async function route(value = text) {
    const transcript = value.trim();
    if (!transcript) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const request = ++sequence.current;
    setBusy(true); setError(""); setResult(null);
    window.speechSynthesis?.cancel();
    try {
    const response = await fetch("/api/voice/command", {
      signal: controller.signal,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript, contextNodeId }),
    });
    if (!response.ok) throw new Error("Could not route that command. Please retry.");
    const next: VoiceRoute = await response.json();
    if (request !== sequence.current) return;
    setResult(next);
    const actionId = next.route?.actionId;
    if (actionId && !next.route?.unresolved && !next.route?.requiresApproval && next.route!.confidence >= 0.85) {
      const rail = RAIL_NAVIGATION[actionId as keyof typeof RAIL_NAVIGATION];
      if (rail) useUmbra.getState().wakeRail(rail);
      else if (OPS_NAVIGATION[actionId]) router.push(OPS_NAVIGATION[actionId]);
    }
    if (spoken && window.speechSynthesis) {
      const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.localService && candidate.lang.startsWith("en"));
      if (voice) {
        const utterance = new SpeechSynthesisUtterance(next.spokenSummary);
        utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
      } else setError("No local English voice is available; showing the response instead.");
    }
    } catch (cause) {
      if (!controller.signal.aborted && request === sequence.current) setError(cause instanceof Error ? cause.message : "Routing failed");
    } finally { if (request === sequence.current) setBusy(false); }
  }

  return (
    <div className="absolute left-1/2 top-[calc(50%+230px)] z-20 w-[520px] -translate-x-1/2 border border-line bg-panel/90 px-[16px] py-[12px] text-[10px]" data-keep-rail>
      <div className="flex items-center justify-between gap-4">
        <span className="tracking-[3px] text-active">VOICE</span>
        {contextLabel && <span className="truncate text-dim">context · {contextLabel}</span>}
      </div>
      <div className="mt-[10px] flex items-center gap-[10px]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void route();
          }}
          placeholder="transcript preview…"
          className="min-w-0 flex-1 border border-line bg-black/20 px-[10px] py-[7px] text-ink outline-none placeholder:text-ghost"
        />
        <button type="button" onClick={() => void route()} className="border border-active px-[12px] py-[7px] tracking-[2px] text-active hover:bg-active/10">
          RETRY ROUTE
        </button>
      </div>
      <VoiceMicrophone onTranscript={(transcript) => { setText(transcript); setResult(null); void route(transcript); }} />
      <label className="mt-2 flex items-center gap-2 text-dim"><input type="checkbox" checked={spoken} onChange={(event) => { setSpoken(event.target.checked); if (!event.target.checked) window.speechSynthesis?.cancel(); }} />Speak responses · local voice only</label>
      <div role="status" aria-live="polite" className="mt-2 text-dim">{busy ? "Understanding command…" : error}</div>
      {result && (
        <div className="mt-[9px] truncate text-dim">
          <span className={result.route?.unresolved ? "text-attention" : "text-mid"}>{result.spokenSummary}</span>
          {result.route?.actionId ? <span className="text-ghost"> · {result.route.actionId}</span> : null}
        </div>
      )}
    </div>
  );
}
