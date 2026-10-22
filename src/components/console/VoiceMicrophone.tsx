"use client";

import { useEffect, useRef, useState } from "react";

export default function VoiceMicrophone({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const cleanup = useRef<() => void>(() => {});
  const stop = useRef<() => void>(() => {});
  const alive = useRef(true);
  const generation = useRef(0);
  const held = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; cleanup.current(); };
  }, []);

  async function start(pushToTalk = false) {
    window.speechSynthesis?.cancel();
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError("Microphone recording is not supported in this browser."); return; }
    setState("permission");
    const attempt = ++generation.current;
    cleanup.current = () => { generation.current += 1; };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || attempt !== generation.current || (pushToTalk && !held.current)) { stream.getTracks().forEach((t) => t.stop()); return; }
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const controller = new AbortController();
      let cancelled = false;
      const monitor = new AudioContext();
      const analyser = monitor.createAnalyser();
      analyser.fftSize = 1024;
      monitor.createMediaStreamSource(stream).connect(analyser);
      const waveform = new Float32Array(analyser.fftSize);
      const started = performance.now();
      let lastSpeech = started;
      let speechFrames = 0;
      const silenceTimer = window.setInterval(() => {
        analyser.getFloatTimeDomainData(waveform);
        const rms = Math.sqrt(waveform.reduce((sum, value) => sum + value * value, 0) / waveform.length);
        if (rms > 0.015) { lastSpeech = performance.now(); speechFrames += 1; }
        if (!pushToTalk && speechFrames >= 3 && performance.now() - lastSpeech > 1200) stop.current();
        if (speechFrames < 3 && performance.now() - started > 8000) stop.current();
      }, 100);
      const timer = window.setTimeout(() => stop.current(), 30_000);
      const release = () => { clearTimeout(timer); clearInterval(silenceTimer); if (monitor.state !== "closed") void monitor.close(); stream.getTracks().forEach((t) => t.stop()); };
      stop.current = () => { if (recorder.state !== "inactive") recorder.stop(); release(); };
      cleanup.current = () => { cancelled = true; controller.abort(); stop.current(); };
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        release();
        if (cancelled) return;
        if (speechFrames < 3) { setError("No speech detected. Try again closer to the microphone."); setState("idle"); return; }
        setState("transcribing");
        try {
          const context = new AudioContext();
          let decoded: AudioBuffer;
          try { decoded = await context.decodeAudioData(await new Blob(chunks).arrayBuffer()); }
          finally { await context.close(); }
          const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
          const source = offline.createBufferSource();
          source.buffer = decoded; source.connect(offline.destination); source.start();
          const samples = (await offline.startRendering()).getChannelData(0);
          const buffer = new ArrayBuffer(44 + samples.length * 2);
          const view = new DataView(buffer);
          const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
          text(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); text(8, "WAVEfmt ");
          view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
          view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
          text(36, "data"); view.setUint32(40, samples.length * 2, true);
          samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true));
          if (cancelled) return;
          const response = await fetch("/api/voice/transcribe", { method: "POST", body: new Blob([buffer], { type: "audio/wav" }), signal: controller.signal });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Transcription failed");
          if (!cancelled && alive.current) onTranscript(data.transcript);
        } catch (e) { if (!cancelled && alive.current) setError(e instanceof Error ? e.message : "Transcription failed"); }
        finally { if (!cancelled && alive.current) setState("idle"); }
      };
      recorder.start(); setState("listening");
    } catch { if (alive.current && attempt === generation.current) { setError("Microphone unavailable or permission denied."); setState("idle"); } }
  }
  return <div className="mt-2 text-[10px] text-dim">
    <button type="button" disabled={state === "permission" || state === "transcribing"} onClick={() => state === "listening" ? stop.current() : void start()} className="text-active disabled:opacity-50">{state === "listening" ? "STOP RECORDING" : state === "idle" ? "SPEAK" : state.toUpperCase()}</button>
    <button type="button" className="ml-3 rounded-full border border-line px-3 py-1 text-active" aria-label="Hold to talk. Hold Space or Enter while focused." onKeyDown={(event) => {
      if ((event.code === "Space" || event.code === "Enter") && !event.repeat && state === "idle") { event.preventDefault(); held.current = true; void start(true); }
    }} onKeyUp={(event) => {
      if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); held.current = false; if (state === "permission") { cleanup.current(); setState("idle"); } else if (state === "listening") stop.current(); }
    }} onPointerDown={(event) => {
      if (state !== "idle") return;
      event.currentTarget.setPointerCapture(event.pointerId); held.current = true; void start(true);
    }} onPointerUp={() => { held.current = false; if (state === "permission") { cleanup.current(); setState("idle"); } else if (state === "listening") stop.current(); }} onPointerCancel={() => { held.current = false; cleanup.current(); setState("idle"); }} onBlur={() => { if (held.current) { held.current = false; cleanup.current(); setState("idle"); } }}>HOLD TO TALK</button>
    <span className="ml-3">local · preview only</span>
    {state !== "idle" && <button type="button" className="ml-3 text-attention" onClick={() => { cleanup.current(); setState("idle"); }}>CANCEL</button>}
    {error && <p role="alert" className="mt-2 text-attention">{error}</p>}
  </div>;
}
