#!/usr/bin/env node
import { relative } from "node:path";
import { AUDIT_FILE } from "./audit.js";
import { loadConfig } from "./config.js";
import { Helper, VERSION } from "./helper.js";
import { startServer } from "./server.js";
import { choosePtyMode } from "./sessions.js";

/** `pnpm helper` (repo root). Flags: --print-env (print the .env.local lines and exit). */
const { config, path, created } = loadConfig();
const url = `http://${config.host === "::1" ? "[::1]" : config.host}:${config.port}`;
const envLines = `UMBRA_HELPER_URL=${url}\nUMBRA_HELPER_TOKEN=${config.token}`;

if (process.argv.includes("--print-env")) {
  console.log(envLines);
  process.exit(0);
}

const pty = choosePtyMode(config.pty);
const helper = new Helper(config, pty);

try {
  await startServer(config, helper);
} catch (e) {
  const err = e as NodeJS.ErrnoException;
  console.error(err.code === "EADDRINUSE" ? `✕ port ${config.port} is in use (another helper running?) · change "port" in ${path}` : `✕ ${err.message}`);
  process.exit(1);
}
await helper.start();

const here = relative(process.cwd(), path) || path;
console.log(`umbra helper ${VERSION} · ${url} (loopback only) · helper terminals: ${pty.note}`);
if (helper.herdr.mode !== "off") {
  console.log(`herdr ${helper.herdr.note} · ${helper.projects.length} project(s) from open workspaces: ${helper.projects.map((p) => p.label && p.label !== p.repo ? `${p.repo} (${p.label})` : p.repo).join(", ") || "none"}`);
} else {
  console.log(`herdr off (${helper.herdr.note}) · fallback: ${helper.projects.length} repo(s) under ${config.projectsRoot} ${config.herdr.transport === "off" ? "" : " · retrying every 15s"}`);
}
console.log(`config ${here} · audit ${relative(process.cwd(), AUDIT_FILE) || AUDIT_FILE}`);
if (created) {
  console.log("\nFirst run: created the config with a new token. Add these two lines to .env.local in the repo root,");
  console.log("then (re)start `pnpm dev`:\n");
  console.log(envLines.replace(/^/gm, "  "));
  console.log("");
} else {
  console.log("(.env.local lines: pnpm helper --print-env)");
}

const shutdown = () => {
  helper.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
