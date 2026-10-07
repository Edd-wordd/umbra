#!/usr/bin/env node
/**
 * Pings end to end, without a Mac: mock Herdr + the real helper, notifier stubbed.
 *   pnpm helper:test      (builds helper/dist first)
 *
 * UMBRA_PINGS_FILE makes the notifier append each ping to a file instead of
 * showing it; UMBRA_JUMP_DRYRUN=1 makes jumps report `open …` instead of running it.
 * Checks: blocked → one ping (not two), done → one ping, a dev server dying →
 * one ping (and none after a ctrl+c), jump links (focus via Herdr, expiry,
 * loopback-only), --test-ping through a running helper, dedup across a
 * restart, and the CI / stale-work / quiet-hours rules on their own.
 */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "../dist");
const T = mkdtempSync(join(tmpdir(), "umbra-pings-"));
const ROOT = join(T, "projects");
const HOME = join(T, "home");
const SOCK = join(T, "herdr.sock");
const PINGS = join(T, "pings.jsonl");
const LOGS = join(T, "logs");
const PORT = 17000 + Math.floor(Math.random() * 2000);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const children = [];
let failed = false;

for (const repo of ["parallax", "deadbridge-site", "umbra", "google"]) {
  mkdirSync(join(ROOT, repo), { recursive: true });
  execFileSync("git", ["init", "-q", join(ROOT, repo)]);
}
mkdirSync(HOME, { recursive: true });

const cfgPath = join(T, "umbra.helper.json");
writeFileSync(
  cfgPath,
  JSON.stringify({
    port: PORT,
    token: "t".repeat(40),
    herdr: { transport: "socket", socket: SOCK, bin: "herdr" },
    projectsRoot: ROOT,
    projects: [],
    fallbackProjects: [],
    poll: { herdrSeconds: 1, procSeconds: 0.25, gitSeconds: 600, ciSeconds: 600 },
    pings: { cooldownMinutes: 5, serverGraceSeconds: 2, serverMinUpSeconds: 0, sound: "" },
    jumpTerminalApp: "Ghostty",
  }),
);
const env = { ...process.env, HOME, UMBRA_HELPER_CONFIG: cfgPath, UMBRA_HELPER_LOGS: LOGS, UMBRA_PINGS_FILE: PINGS, UMBRA_JUMP_DRYRUN: "1", UMBRA_GH: "/bin/false" };

function start(file, args, label, ready) {
  const c = spawn(process.execPath, [file, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
  children.push(c);
  let out = "";
  const done = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} didn't start:\n${out}`)), 15000);
    const on = (d) => {
      out += d;
      if (process.env.VERBOSE) process.stdout.write(`[${label}] ${d}`);
      if (ready.test(out)) {
        clearTimeout(t);
        resolve(c);
      }
    };
    c.stdout.on("data", on);
    c.stderr.on("data", on);
  });
  c.output = () => out;
  return done;
}

function herdr(method, params = {}) {
  return new Promise((resolve, reject) => {
    const s = createConnection(SOCK);
    let buf = "";
    s.on("connect", () => s.write(JSON.stringify({ id: "t", method, params }) + "\n"));
    s.on("data", (d) => (buf += d));
    s.on("end", () => {
      const env = JSON.parse(buf.trim());
      env.error ? reject(new Error(env.error.message)) : resolve(env.result);
    });
    s.on("error", reject);
  });
}

const pings = () => (existsSync(PINGS) ? readFileSync(PINGS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const matching = (re) => pings().filter((p) => re.test(`${p.title} ${p.message}`));
const audit = () => readFileSync(join(LOGS, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const get = (path, host = `127.0.0.1:${PORT}`) =>
  new Promise((resolve, reject) => {
    // node's fetch won't let us set Host; a raw request can.
    const s = createConnection(PORT, "127.0.0.1");
    let buf = "";
    s.on("connect", () => s.write(`GET ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`));
    s.on("data", (d) => (buf += d));
    s.on("end", () => resolve({ status: Number(buf.split(" ")[1]), text: buf }));
    s.on("error", reject);
  });
async function until(fn, ms = 8000, step = 150) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await wait(step);
  }
  return fn();
}
function listen(port, cwd) {
  const c = spawn(process.execPath, ["-e", `require("http").createServer((q,r)=>r.end("ok")).listen(${port},"127.0.0.1")`], { cwd, stdio: "ignore" });
  children.push(c);
  return c;
}
async function step(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed = true;
    console.log(`  ✕ ${name}\n    ${e.message.split("\n").join("\n    ")}`);
  }
}

try {
  await start(join(here, "mock-herdr.mjs"), ["--socket", SOCK, "--root", ROOT, "--home", HOME], "mock", /mock herdr/);
  let helper = await start(join(dist, "main.js"), [], "helper", /pings via|pings off/);
  await wait(1500);
  console.log(`pings test · helper :${PORT} · ${T}`);

  await step("startup sends nothing (nothing is blocked)", async () => {
    assert.equal(pings().length, 0, JSON.stringify(pings()));
  });

  await step("agent → blocked pings once, labeled by workspace, jump to its pane", async () => {
    await herdr("mock.set_status", { pane_id: "wY:p1", status: "blocked", screen: "Allow running `pnpm build`? [y/n]" });
    const p = await until(() => matching(/needs you/)[0]);
    assert.ok(p, "no blocked ping");
    assert.match(p.title, /parallax · cursor \(ws 6\) needs you/);
    assert.match(p.message, /pnpm build/);
    assert.match(p.url, new RegExp(`^http://127\\.0\\.0\\.1:${PORT}/jump/[\\w-]{20,}$`));
    await wait(2500); // more snapshots of the same blocked state
    assert.equal(matching(/needs you/).length, 1);
  });

  await step("blocked again inside the cooldown → still one ping", async () => {
    await herdr("mock.set_status", { pane_id: "wY:p1", status: "working" });
    await wait(1200);
    await herdr("mock.set_status", { pane_id: "wY:p1", status: "blocked", screen: "Allow again? [y/n]" });
    await wait(2500);
    assert.equal(matching(/needs you/).length, 1);
  });

  await step("agent working → done pings once (finished)", async () => {
    await herdr("mock.set_status", { pane_id: "wT:p1", status: "working" });
    await wait(1500);
    await herdr("mock.set_status", { pane_id: "wT:p1", status: "done", screen: "● Done" });
    const p = await until(() => matching(/finished/)[0]);
    assert.ok(p, "no done ping");
    assert.match(p.title, /deadbridge-site · codex \(ws 2\) finished/);
    await wait(2500);
    assert.equal(matching(/finished/).length, 1);
  });

  await step("working → idle with completion_seq advancing also counts as finished", async () => {
    await herdr("mock.set_status", { pane_id: "wV:p1", status: "working" });
    await wait(1500);
    await herdr("mock.set_status", { pane_id: "wV:p1", status: "idle", completed: true });
    const p = await until(() => matching(/google · pi finished/)[0]);
    assert.ok(p, "no idle-completion ping");
  });

  await step("jump link focuses the pane through Herdr, raises the terminal, is audited", async () => {
    const url = new URL(matching(/needs you/)[0].url);
    const r = await get(url.pathname);
    assert.equal(r.status, 200, r.text);
    assert.match(r.text, /focused parallax · cursor \(ws 6\) in Herdr/);
    assert.match(r.text, /window\.close/);
    const log = await herdr("mock.log");
    assert.ok(log.log.some((x) => x.method === "agent.focus" && x.pane === "wY:p1"), JSON.stringify(log.log));
    const j = audit().filter((a) => a.action === "jump" && a.via === "link");
    assert.ok(j.some((a) => a.result === "ok" && a.pane === "wY:p1" && /open -a Ghostty/.test(a.cmd)), JSON.stringify(j));
  });

  await step("unknown token → 404; foreign Host header → 403", async () => {
    assert.equal((await get("/jump/AAAAAAAAAAAAAAAAAAAAAAAA")).status, 404);
    const url = new URL(matching(/needs you/)[0].url);
    assert.equal((await get(url.pathname, "evil.example:80")).status, 403);
    assert.equal((await get("/pings", "evil.example")).status, 403);
    assert.match((await get("/pings")).text, /needs you/);
  });

  await step("dev server dies → one ping, link opens the project in Cursor", async () => {
    const port = PORT + 1;
    const srv = listen(port, join(ROOT, "umbra"));
    await wait(4500); // seen by a port scan
    srv.kill("SIGKILL");
    const p = await until(() => matching(new RegExp(`:${port} went down`))[0], 12000);
    assert.ok(p, `no server ping\n${helper.output().slice(-1500)}`);
    assert.match(p.title, /umbra/);
    const r = await get(new URL(p.url).pathname);
    assert.match(r.text, /opened umbra in Cursor/);
    await wait(3000);
    assert.equal(matching(new RegExp(`:${port} went down`)).length, 1);
  });

  await step("dev server stopped with ctrl+c in its project's pane → no ping", async () => {
    const port = PORT + 2;
    const srv = listen(port, join(ROOT, "umbra"));
    await wait(4500);
    await herdr("pane.send_keys", { pane_id: "wZ:p3", keys: ["ctrl+c"] });
    srv.kill("SIGINT");
    await wait(9000);
    assert.equal(matching(new RegExp(`:${port}`)).length, 0, JSON.stringify(pings()));
    assert.match(helper.output(), new RegExp(`:${port} \\(umbra\\) stopped · expected \\(ctrl\\+c`));
  });

  await step("--test-ping asks the running helper; its link opens umbra in Cursor", async () => {
    const out = execFileSync(process.execPath, [join(dist, "main.js"), "--test-ping"], { env, encoding: "utf8" });
    assert.match(out, /test ping sent by the running helper · file · http/);
    const p = matching(/test ping/)[0];
    assert.ok(p);
    const r = await get(new URL(p.url).pathname);
    assert.match(r.text, /opened umbra in Cursor/);
  });

  await step("restart: still-blocked agent isn't pinged again (dedup persisted); old links still work", async () => {
    helper.kill("SIGTERM");
    await wait(600);
    helper = await start(join(dist, "main.js"), [], "helper2", /pings via|pings off/);
    await wait(3000);
    assert.equal(matching(/needs you/).length, 1);
    const r = await get(new URL(matching(/needs you/)[0].url).pathname);
    assert.equal(r.status, 200);
  });

  /* --- rules in isolation ------------------------------------------------------------ */
  Object.assign(process.env, { UMBRA_PINGS_FILE: PINGS, UMBRA_HELPER_LOGS: LOGS });
  const { Pings, inQuietHours } = await import(join(dist, "pings.js"));
  const { Jumps } = await import(join(dist, "jumps.js"));
  const { defaultConfig } = await import(join(dist, "config.js"));
  const base = defaultConfig("x").pings;
  const jumps = new Jumps(join(T, "unit-jumps.json"));
  const unit = (over = {}) => new Pings({ ...base, sound: "", ...over }, jumps, "http://127.0.0.1:7317", {}, join(T, `p-${Math.random()}.json`));
  const targetOf = (p) => jumps.get(p.jump.split("/jump/")[1]);

  await step("CI failure pings once per run, with the GitHub run as the jump", async () => {
    const before = pings().length;
    const x = unit();
    const run = { id: "ci-parallax-42", repo: "parallax", branch: "main", number: 42, status: "failed", summary: "1 job failed · CI", failing: ["test › vitest"], at: Date.now(), url: "https://github.com/eddwordd/parallax/actions/runs/42" };
    x.ci(run, "/tmp/parallax");
    x.ci(run, "/tmp/parallax");
    x.ci({ ...run, id: "ci-parallax-41", at: Date.now() - 7 * 3_600_000 }, "/tmp/parallax"); // old news
    await wait(300);
    assert.equal(pings().length - before, 1);
    assert.equal(x.recent[0].kind, "ci.failed");
    assert.match(x.recent[0].title, /parallax · CI failed/);
    assert.deepEqual(targetOf(x.recent[0]), { kind: "url", url: run.url });
  });

  await step("stale work: once a day, off by default, no remote = uncommitted only", async () => {
    const rows = [
      { repo: "umbra", dir: "/tmp/umbra", remote: null, uncommitted: 0, idleSince: 0, ahead: 9, oldestUnpushedAt: 0 },
      { repo: "google", dir: "/tmp/google", remote: "eddwordd/google", uncommitted: 2, idleSince: Date.now() - 5 * 86_400_000, ahead: 0 },
    ];
    const off = unit();
    off.staleWork(rows);
    const on = unit({ staleWork: true });
    on.staleWork(rows);
    on.staleWork(rows);
    await wait(300);
    assert.equal(off.recent.length, 0);
    assert.equal(on.recent.length, 1);
    assert.match(on.recent[0].message, /^google 2 uncommitted$/);
  });

  await step("quiet hours wrap past midnight; pings inside are recorded as quiet", async () => {
    const q = { enabled: true, start: "22:00", end: "08:00" };
    assert.equal(inQuietHours(q, new Date(2026, 9, 6, 23, 30)), true);
    assert.equal(inQuietHours(q, new Date(2026, 9, 6, 7, 59)), true);
    assert.equal(inQuietHours(q, new Date(2026, 9, 6, 12, 0)), false);
    assert.equal(inQuietHours({ ...q, enabled: false }, new Date(2026, 9, 6, 23, 30)), false);
    const all = { enabled: true, start: "00:00", end: "23:59" };
    const x = unit({ quietHours: all });
    const before = pings().length;
    x.agents([{ pane: "w1:p1", repo: "umbra", agent: "cursor", status: "blocked", seq: 1, completion: null }]);
    await wait(200);
    assert.equal(x.recent[0]?.delivery, "quiet");
    assert.equal(pings().length, before);
  });
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  for (const c of children) c.kill("SIGTERM");
}
console.log(failed ? "pings test FAILED" : "pings test passed");
process.exit(failed ? 1 : 0);
