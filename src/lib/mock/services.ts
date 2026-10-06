/**
 * SAMPLE service payloads, shaped exactly like each adapter's payload type
 * (what the bridge will serve per service per repo). Every number, id and
 * name is made up.
 */
import type { DockerPayload } from "../dev/services/docker";
import type { FigmaPayload } from "../dev/services/figma";
import type { GithubPayload } from "../dev/services/github";
import type { PosthogPayload } from "../dev/services/posthog";
import type { SentryPayload } from "../dev/services/sentry";
import type { SupabasePayload } from "../dev/services/supabase";
import type { ServicePayloads } from "../dev/services/types";
import type { RepoId } from "../dev/types";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
type PerRepo<P> = Partial<Record<RepoId, P>>;

export type MockVariant = "default" | "quiet";

/** `quiet` = a good day: everything pushed, CI green, no Sentry issues, no blips. */
export function createServicePayloads(now: number, variant: MockVariant = "default"): ServicePayloads {
  const quiet = variant === "quiet";
  const github: PerRepo<GithubPayload> = {
    umbra: {
      remote: quiet ? "eddwordd/umbra" : null,
      branch: "main",
      uncommitted: 0,
      ahead: quiet ? 0 : 6,
      staleBranches: [],
      lastCommit: { sha: "e00719a", message: "Add Dev focus mockup", at: now - 32 * MIN },
      openPrs: 0,
      workflows: false,
      localChecks: quiet ? undefined : { text: "lint ✓ build ✓", at: now - 30 * MIN },
    },
    parallax: {
      remote: "eddwordd/parallax",
      branch: quiet ? "main" : "fix/target-sort",
      uncommitted: quiet ? 0 : 1,
      ahead: quiet ? 0 : 2,
      staleBranches: [
        { name: "feat/moon-phase", days: 31 },
        { name: "spike/indi-ws", days: 19 },
      ],
      lastCommit: { sha: "a91c2e4", message: "wip: sort targets by transit", at: now - 18 * MIN },
      openPrs: 0,
      workflows: true,
    },
    "deadbridge-site": {
      remote: "eddwordd/deadbridge-site",
      branch: "fix/start-form-lint",
      uncommitted: 3,
      ahead: 0,
      staleBranches: [{ name: "redesign/hero-v2", days: 44 }],
      lastCommit: { sha: "5be19c0", message: "copy: tighten pricing section", at: now - 2 * DAY },
      openPrs: 0,
      workflows: true,
    },
    google: {
      remote: "eddwordd/google",
      branch: "master",
      uncommitted: 2,
      ahead: 0,
      staleBranches: [],
      lastCommit: { sha: "c40d7aa", message: "labels: cache label ids", at: now - 6 * DAY },
      openPrs: 0,
      workflows: false,
    },
  };

  const sentry: PerRepo<SentryPayload> = {
    parallax: {
      org: "eddwordd",
      project: "parallax",
      issues: quiet
        ? []
        : [
        {
          id: "SAMPLE-7Q",
          title: "TypeError: Cannot read properties of undefined (reading 'transit')",
          count24h: 23,
          firstSeen: "10-04 21:12",
          excerpt: [
            "TypeError: Cannot read properties of undefined (reading 'transit')",
            "  at sortByTransit (src/lib/targets.ts:88:31)",
            "  at Array.sort (<anonymous>)",
            "  at TonightList (src/app/tonight/page.tsx:24:18)",
          ],
        },
        { id: "SAMPLE-2B", title: "Timeout fetching ephemeris", count24h: 2, firstSeen: "10-05 03:40", excerpt: [] },
      ],
    },
  };

  const posthog: PerRepo<PosthogPayload> = {
    "deadbridge-site": {
      project: "deadbridge.app",
      pageviews24h: quiet ? 1412 : 1912,
      deltaVs7d: quiet ? 4 : 38,
      trend: quiet ? [1302, 1388, 1251, 1420, 1366, 1395, 1412] : [1302, 1388, 1251, 1420, 1366, 1395, 1912],
      form: { name: "start-a-project", submits24h: 6, errors24h: 0 },
      topPage: { path: "/pricing", share: 31 },
    },
  };

  const supabase: PerRepo<SupabasePayload> = {
    "deadbridge-site": {
      project: "deadbridge-prod",
      region: "us-west-1",
      dbMb: 41,
      dbLimitMb: 500,
      tables: [{ name: "leads", rows: 1284, today: 6 }],
      authUsers: 3,
      functions: [{ name: "lead-intake", errors24h: 0 }],
    },
  };

  const docker: PerRepo<DockerPayload> = {
    "deadbridge-site": {
      host: "docker-01",
      containers: [
        { name: "frappe-crm", image: "frappe/erpnext:v15", state: "running", up: "23d", port: 8000 },
        { name: "mariadb", image: "mariadb:10.6", state: "running", up: "23d" },
        { name: "redis-cache", image: "redis:7-alpine", state: "running", up: "23d" },
      ],
    },
  };

  const figma: PerRepo<FigmaPayload> = {
    "deadbridge-site": { file: "Deadbridge / Site v3", editedAt: now - 40 * MIN, editor: "Edward", openComments: 2, frames: 14 },
  };

  return { github, sentry, posthog, supabase, docker, figma };
}
