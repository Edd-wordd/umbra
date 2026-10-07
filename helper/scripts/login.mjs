#!/usr/bin/env node
/**
 * Start the helper at login (launchd), or stop doing that.
 *   pnpm helper:install-login     (root; builds helper/dist first)
 *   pnpm helper:uninstall-login
 *   node helper/scripts/login.mjs print     (just print the plist it would write)
 * Fills helper/launchd/com.umbra.helper.plist.example; no shell, no sudo.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LABEL = "com.umbra.helper";
const HELPER = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(HELPER, "..");
const HOME = homedir();
const PLIST = join(HOME, "Library", "LaunchAgents", `${LABEL}.plist`);
const DOMAIN = `gui/${userInfo().uid}`;
const cmd = process.argv[2];

const fail = (msg) => {
  console.error(`✕ ${msg}`);
  process.exit(1);
};
const xml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const PATH = [...new Set([join(HOME, ".local/bin"), "/usr/local/bin", "/opt/homebrew/bin", dirname(process.execPath), "/usr/bin", "/bin", "/usr/sbin", "/sbin"])].join(":");

function plist() {
  const vals = { "@NODE@": process.execPath, "@REPO@": REPO, "@HOME@": HOME, "@PATH@": PATH };
  return readFileSync(join(HELPER, "launchd", `${LABEL}.plist.example`), "utf8")
    .replace(/<!--[\s\S]*?-->\n/, `<!-- written by pnpm helper:install-login · remove with pnpm helper:uninstall-login -->\n`)
    .replace(/@(NODE|REPO|HOME|PATH)@/g, (m) => xml(vals[m]));
}

function launchctl(args, quiet = false) {
  try {
    execFileSync("/bin/launchctl", args, { stdio: quiet ? "ignore" : "inherit" });
    return true;
  } catch {
    return false;
  }
}

async function helperAlreadyUp() {
  try {
    const cfg = JSON.parse(readFileSync(join(HELPER, "umbra.helper.json"), "utf8"));
    const r = await fetch(`http://127.0.0.1:${cfg.port ?? 7317}/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

if (cmd === "print") {
  process.stdout.write(plist());
} else if (cmd === "install") {
  if (process.platform !== "darwin") fail("login items are macOS only (try: node helper/scripts/login.mjs print)");
  if (!existsSync(join(HELPER, "dist", "main.js"))) fail("helper/dist/main.js missing · run pnpm helper:build first");
  const running = await helperAlreadyUp();
  mkdirSync(dirname(PLIST), { recursive: true });
  mkdirSync(join(HOME, "Library", "Logs"), { recursive: true });
  writeFileSync(PLIST, plist());
  if (launchctl(["bootout", `${DOMAIN}/${LABEL}`], true)) await new Promise((r) => setTimeout(r, 1500)); // replace an older copy (bootout settles async)
  if (!launchctl(["bootstrap", DOMAIN, PLIST])) fail(`launchctl bootstrap ${DOMAIN} ${PLIST} failed · see: launchctl print ${DOMAIN}/${LABEL}`);
  console.log(`✓ ${LABEL} starts at login · ${PLIST}`);
  console.log(`  node ${process.execPath} · logs ~/Library/Logs/umbra-helper.log`);
  if (running) console.log("  ! a helper was already answering (pnpm helper in a terminal?) · stop it, launchd retries every 10 s");
  console.log("  check: launchctl print " + `${DOMAIN}/${LABEL} | head -20 · test: pnpm helper --test-ping`);
} else if (cmd === "uninstall") {
  if (process.platform !== "darwin") fail("login items are macOS only");
  const was = launchctl(["bootout", `${DOMAIN}/${LABEL}`], true);
  if (existsSync(PLIST)) rmSync(PLIST);
  console.log(`✓ ${LABEL} removed${was ? " (stopped the running copy)" : ""}`);
} else {
  console.error("usage: login.mjs install | uninstall | print");
  process.exit(2);
}
