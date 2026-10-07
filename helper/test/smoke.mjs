#!/usr/bin/env node
/**
 * Smoke client: talks to a running helper the way the Next app does.
 *   UMBRA_HELPER_CONFIG=/tmp/x.json node helper/test/smoke.mjs [snapshot|watch <sessionId>|kill <pid>|respond <agentId>|exec <sessionId> <cmd>|focus <sessionId>|events <seconds>]
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const WebSocket = require("ws");

const cfg = JSON.parse(readFileSync(process.env.UMBRA_HELPER_CONFIG ?? new URL("../umbra.helper.json", import.meta.url), "utf8"));
const base = `http://127.0.0.1:${cfg.port}`;
const auth = { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" };
const [cmd = "snapshot", a1, ...rest] = process.argv.slice(2);

const post = async (path, body) => {
  const r = await fetch(base + path, { method: "POST", headers: auth, body: JSON.stringify(body ?? {}) });
  return { status: r.status, body: await r.json() };
};

const { body: t } = await post("/session");
const ws = new WebSocket(`ws://127.0.0.1:${cfg.port}/ws?ticket=${t.ticket}`, { headers: { origin: "http://localhost:3107" } });
const events = [];
let snap;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
ws.on("message", (d) => {
  const ev = JSON.parse(String(d));
  if (ev.type === "snapshot") snap = ev.snapshot;
  else events.push(ev);
});
await new Promise((r) => ws.once("open", r));
await wait(400);
const send = (req) => ws.send(JSON.stringify(req));
const short = (ev) => {
  if (ev.type === "session.upsert") return `session.upsert ${ev.session.id} lines=${ev.lines?.length ?? "-"}${ev.lines?.length ? ` last="${ev.lines.at(-1).text}"` : ""}`;
  if (ev.type === "agent.upsert") return `agent.upsert ${ev.agent.id} ${ev.agent.state}${ev.agent.prompt ? ` prompt="${ev.agent.prompt.title}"` : ""}`;
  if (ev.type === "notice") return `notice [${ev.result}] ${ev.text}`;
  if (ev.type === "servers.set") return `servers.set ${ev.servers.map((s) => `:${s.port}/${s.state}`).join(" ")}`;
  if (ev.type === "projects.set") return `projects.set ${ev.projects.map((p) => p.repo).join(",")} recent=${ev.recent.map((p) => p.repo).join(",")}`;
  if (ev.type === "term.append") return `term.append ${ev.sessionId} ${ev.lines.map((l) => l.text).join(" | ")}`;
  return ev.type;
};

switch (cmd) {
  case "snapshot": {
    console.log("projects:", snap.projects.map((p) => `${p.repo} (${p.label}, ws ${p.workspaces?.join("+")}, ${p.agentStatus}, ${p.services.join("/")})`).join("; "));
    console.log("agents:", snap.agents.map((x) => `${x.id} ${x.agent} ${x.state} repo=${x.repo} task="${x.task}" ${x.note}`).join("\n        "));
    console.log("servers:", snap.servers.map((s) => `:${s.port} ${s.repo ?? "-"} ${s.state} pid=${s.pid} ${s.sessionId ?? ""} ${s.note ?? ""}`).join("\n         "));
    console.log("ci:", snap.ci.map((c) => `${c.repo} ${c.status} ${c.summary} ${c.failing.join(",")}`).join("; "));
    for (const [repo, g] of Object.entries(snap.services.github)) console.log(`git ${repo}: ${g.branch} unc=${g.uncommitted} ahead=${g.ahead} behind=${g.behind} remote=${g.remote ?? "none"} stale=${(g.staleBranches ?? []).map((b) => b.name ?? b).join(",")} prs=${g.openPrs} last="${g.lastCommit.message}"`);
    console.log("sessions:", Object.keys(snap.sessions).length, "agentKinds:", snap.agentKinds.join(","), "handoff:", snap.handoff.items.map((i) => `${i.repo}:${i.tone}`).join(" "));
    break;
  }
  case "watch":
    send({ type: "term.watch", sessionId: a1, on: true });
    await wait(2500);
    break;
  case "exec": {
    const req = { type: "term.exec", sessionId: a1, command: rest.join(" ") };
    send({ type: "term.watch", sessionId: a1, on: true });
    const ap = await post("/approvals", { action: req });
    if (ap.status === 200) req.approvalId = ap.body.approvalId;
    console.log("approval:", ap.status, ap.body.approvalId ? "issued" : ap.body.error);
    send(req);
    await wait(3000);
    break;
  }
  case "exec-noapproval":
    send({ type: "term.exec", sessionId: a1, command: rest.join(" ") });
    await wait(1500);
    break;
  case "kill": {
    const req = { type: "process.kill", pid: Number(a1) };
    send(req); // without approval first: must be refused
    await wait(500);
    const ap = await post("/approvals", { action: req });
    console.log("approval:", ap.status, ap.body.approvalId ? "issued" : ap.body.error);
    send({ ...req, approvalId: ap.body.approvalId });
    await wait(2500);
    break;
  }
  case "respond": {
    const ag = snap.agents.find((x) => x.id === a1);
    console.log("prompt:", JSON.stringify(ag?.prompt));
    send({ type: "agent.respond", agentId: a1, promptId: ag?.prompt?.id ?? "?", answer: rest[0] ?? "approve" });
    await wait(1500);
    break;
  }
  case "focus":
    send({ type: "pane.focus", sessionId: a1 });
    await wait(800);
    break;
  case "events":
    await wait(Number(a1 ?? 5) * 1000);
    break;
}
for (const ev of events) console.log("  ·", short(ev));
ws.close();
process.exit(0);
