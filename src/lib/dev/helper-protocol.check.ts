/**
 * Compile-time only: the Mac helper (helper/src/protocol.ts, no imports so it
 * builds on its own) must stay wire-compatible with the app's bridge types.
 * `pnpm typecheck` fails here if either side drifts. No runtime code.
 */
import type * as H from "../../../helper/src/protocol";
import type { AgentSession, CiRun, DevEvent, DevRequest, DevServer, LiveProject, RecentProject, TermSession } from "./types";

type Extends<A, B> = [A] extends [B] ? true : false;
type Assert<T extends true> = T;

// Helper → app: everything the helper emits must be something the store understands.
export type HelperToApp = [
  Assert<Extends<H.AgentSession, AgentSession>>,
  Assert<Extends<H.TermSession, TermSession>>,
  Assert<Extends<H.DevServer, DevServer>>,
  Assert<Extends<H.CiRun, CiRun>>,
  Assert<Extends<H.ProjectInfo, LiveProject>>,
  Assert<Extends<H.RecentProject, RecentProject>>,
  // Payload-typed events (snapshot services, service payloads) are checked by the adapters at runtime.
  Assert<Extends<Exclude<H.HelperEvent, { type: "snapshot" } | { type: "service.upsert" }>, DevEvent>>,
];

// App → helper: every request the app sends must be one the helper accepts (it ignores `approved`).
export type AppToHelper = Assert<Extends<DevRequest, H.HelperRequest>>;
