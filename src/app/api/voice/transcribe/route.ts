export const runtime = "nodejs";

export async function POST(req: Request) {
  if (req.headers.get("origin") && req.headers.get("origin") !== new URL(req.url).origin) return Response.json({ error: "Origin rejected" }, { status: 403 });
  const configured = process.env.UMBRA_WHISPER_URL;
  if (!configured) return Response.json({ error: "Local Whisper is not configured. Set UMBRA_WHISPER_URL." }, { status: 503 });
  try {
    const url = new URL(configured);
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Whisper must use a loopback HTTP address");
    if (Number(req.headers.get("content-length")) > 2_000_000) return Response.json({ error: "Audio too large" }, { status: 413 });
    const audio = await req.blob();
    if (audio.size > 2_000_000 || audio.size < 44) return Response.json({ error: "Invalid audio size" }, { status: 400 });
    const form = new FormData();
    form.append("file", audio, "command.wav");
    form.append("response_format", "json");
    form.append("prompt", "Umbra, Proxmox, AdGuard, n8n, Obsidian. Lab, Knowledge, Dev, Ops.");
    const response = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(60_000), redirect: "error" });
    if (!response.ok) throw new Error("Local transcription failed");
    const data = await response.json();
    if (typeof data.text !== "string") throw new Error("Invalid transcription response");
    return Response.json({ transcript: data.text.trim(), source: "local-whisper" });
  } catch {
    return Response.json({ error: "Local Whisper unavailable or invalid response. Check the local server configuration." }, { status: 502 });
  }
}
