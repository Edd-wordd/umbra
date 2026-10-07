#!/usr/bin/env node
/**
 * Stand-in for the `herdr` CLI (tests the helper's CLI transport):
 * forwards to the mock socket and prints the {id, result} envelope like herdr does.
 *   HERDR_MOCK_SOCKET=/tmp/herdr.sock node herdr-cli.mjs api snapshot
 */
import { createConnection } from "node:net";

const a = process.argv.slice(2);
const flag = (n) => {
  const i = a.indexOf(`--${n}`);
  return i >= 0 ? a[i + 1] : undefined;
};
const pos = a.filter((x, i) => !x.startsWith("--") && !(i > 0 && a[i - 1].startsWith("--")));
const [noun, verb, target, ...rest] = pos;
const key = `${noun} ${verb}`;
let method;
let params = {};
switch (key) {
  case "api snapshot":
    method = "session.snapshot";
    break;
  case "pane read":
  case "agent read":
    method = key.replace(" ", ".");
    params = { [noun === "pane" ? "pane_id" : "target"]: target, source: (flag("source") ?? "recent").replace("-", "_"), lines: flag("lines") ? Number(flag("lines")) : undefined };
    break;
  case "agent send-keys":
    method = "agent.send_keys";
    params = { target, keys: rest };
    break;
  case "pane send-keys":
    method = "pane.send_keys";
    params = { pane_id: target, keys: rest };
    break;
  case "agent prompt":
    method = "agent.prompt";
    params = { target, text: rest.join(" ") };
    break;
  case "pane run":
    method = "pane.send_input";
    params = { pane_id: target, text: rest.join(" "), keys: ["enter"] };
    break;
  case "pane send-text":
    method = "pane.send_text";
    params = { pane_id: target, text: rest.join(" ") };
    break;
  case "agent focus":
    method = "agent.focus";
    params = { target };
    break;
  case "pane focus":
    method = "pane.focus";
    params = { pane_id: target };
    break;
  case "pane process-info":
    method = "pane.process_info";
    params = { pane_id: target };
    break;
  default:
    console.error(`herdr (mock cli): unsupported: ${a.join(" ")}`);
    process.exit(2);
}
const s = createConnection(process.env.HERDR_MOCK_SOCKET ?? "/tmp/herdr-mock.sock");
s.on("error", (e) => {
  console.error(`error: herdr server not running (${e.code})`);
  process.exit(1);
});
let buf = "";
s.on("connect", () => s.write(JSON.stringify({ id: `cli:${noun}:${verb}`, method, params }) + "\n"));
s.on("data", (d) => {
  buf += d;
  const i = buf.indexOf("\n");
  if (i < 0) return;
  const env = JSON.parse(buf.slice(0, i));
  if (env.result?.type === "pane_read" && !process.env.HERDR_JSON) process.stdout.write(env.result.read.text);
  else console.log(JSON.stringify(env));
  s.end();
  process.exit(env.error ? 1 : 0);
});
