import type { DevSignal } from "../dev/signals";
import type { DevEvent } from "../dev/types";

/**
 * `?mock=events`: sample Dev events streamed into the store one at a time,
 * so the decision layer triages them live. Sample data only.
 */
type Sample = Omit<DevSignal, "id" | "at">;

export const SAMPLE_EVENTS: Sample[] = [
  {
    kind: "ci.failed",
    source: "github",
    repo: "parallax",
    title: "CI failed · main #321 · 2 tests",
    detail: "ephemeris › moonrise within 2 min of almanac; ephemeris › handles DST",
    tone: "broken",
    facts: { branch: "main", run: 321, failing_tests: 2, previous_run_on_main: "passed" },
    fix: { label: "RERUN", toolId: "dev.ci.rerun", args: { repo: "parallax" } },
  },
  {
    kind: "agent.waiting",
    source: "agent",
    repo: "deadbridge-site",
    title: "codex · approve db migration",
    detail: "codex wants to run `prisma migrate dev` (adds leads.source column)",
    tone: "attention",
    facts: { agent: "codex", waiting_for: "approval to run a database migration", blocked_until_answered: true },
  },
  {
    kind: "agent.done",
    source: "agent",
    repo: "umbra",
    title: "cursor done · +120 −14 · ready to review",
    tone: "info",
    facts: { agent: "cursor", lines_added: 120, lines_removed: 14, tests: "passing" },
  },
  {
    kind: "container.restarts",
    source: "docker",
    repo: "deadbridge-site",
    title: "frappe-crm restarted 4× in 10 min",
    detail: "exit 137 (OOM) each time; healthy for ~2 min between restarts",
    tone: "broken",
    facts: { container: "frappe-crm", restarts: 4, window_minutes: 10, exit_reason: "out of memory" },
    fix: { label: "RESTART", toolId: "dev.container.restart", args: { repo: "deadbridge-site", service: "frappe-crm" } },
  },
  {
    kind: "sentry.spike",
    source: "sentry",
    repo: "deadbridge-site",
    title: "TypeError on lead form · 37 events · 12 users",
    detail: "TypeError: Cannot read properties of undefined (reading 'email') in LeadForm.submit",
    tone: "broken",
    facts: { events_last_hour: 37, users_affected: 12, first_seen: "within the last hour", page: "/contact" },
  },
  {
    kind: "lead.new",
    source: "frappe",
    title: "new lead · Maria Ortega · wants a call today",
    detail: "Kitchen remodel, budget ~$40k, asked for a call this afternoon",
    tone: "attention",
    facts: { business: "Deadbridge", lead: "Maria Ortega", asks: "phone call today", replied: false },
  },
  {
    kind: "unpushed.stale",
    source: "git",
    repo: "google",
    title: "5 commits unpushed · feat/ingest · more than 1 day",
    tone: "info",
    facts: { commits: 5, branch: "feat/ingest", age: "more than 1 day", remote_configured: false },
  },
  {
    kind: "posthog.spike",
    source: "posthog",
    repo: "deadbridge-site",
    title: "traffic +180% · referrer reddit",
    detail: "pageviews +180% vs same hour last week; error rate unchanged",
    tone: "info",
    facts: { change_vs_last_week: "+180%", top_referrer: "reddit.com", error_rate_change: "none" },
  },
  {
    kind: "deps.update",
    source: "dependabot",
    repo: "umbra",
    title: "dependabot · bump postcss 8.5.1 → 8.5.2",
    tone: "info",
    facts: { bump: "patch", package: "postcss", security_advisory: false, ci: "passing" },
  },
  {
    kind: "port.stale",
    source: "ports",
    title: ":5173 vite · orphan, no session for 2 h",
    tone: "attention",
    facts: { port: 5173, process: "vite", owner_session_alive: false, idle: "about 2 hours" },
    fix: { label: "FREE", toolId: "dev.port.free", args: { port: "5173" } },
  },
];

/**
 * Stream SAMPLE_EVENTS (one pass). The first arrives after `firstMs`, the
 * rest every `everyMs`. Returns a stop function.
 */
export function streamSampleEvents(apply: (ev: DevEvent) => void, { everyMs = 3500, firstMs = 1200 } = {}): () => void {
  const run = Date.now().toString(36);
  const timers = SAMPLE_EVENTS.map((e, i) =>
    setTimeout(() => apply({ type: "signal", signal: { ...e, id: `evt:${run}:${i}:${e.kind}`, at: Date.now() } }), firstMs + i * everyMs),
  );
  return () => timers.forEach(clearTimeout);
}
