import type { ServiceId } from "./services/types";
import type { HerdrStatus, RepoId } from "./types";

/**
 * Per-project config: which services each repo actually uses. Only these
 * render for a project; nothing gets a permanent slot. Edit freely; the
 * "+ service" picker in the Dev focus adds to this at runtime (local state
 * for now, persisted by the bridge later).
 */
export interface DevProject {
  repo: RepoId;
  path: string;
  services: ServiceId[];
  /** Live (Herdr): workspace label, workspace ids, worst agent status. */
  label?: string;
  workspaces?: string[];
  agentStatus?: HerdrStatus;
}

const P = "/Users/eddwordd/Documents/codes/projects";

export const PROJECTS: readonly DevProject[] = [
  // Local only for now: no remote, no CI. Its dev server shows under DEV SERVERS.
  { repo: "umbra", path: `${P}/umbra`, services: ["github"] },
  { repo: "parallax", path: `${P}/parallax`, services: ["github", "sentry"] },
  { repo: "deadbridge-site", path: `${P}/deadbridge-site`, services: ["github", "supabase", "posthog", "docker", "figma"] },
  { repo: "google", path: `${P}/google`, services: ["github"] },
];
