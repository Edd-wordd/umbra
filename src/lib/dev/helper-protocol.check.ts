/**
 * Compile-time only: the Mac helper (helper/src/protocol.ts, no imports so it
 * builds on its own) must stay wire-compatible with the subset of it the Dev
 * view reads. `pnpm typecheck` fails here if either side drifts. No runtime code.
 */
import type * as H from "../../../helper/src/protocol";
import type { AgentSession, CiRun, DevEvent, DevRequest, DevServer, GitInfo, LiveProject, Ping } from "./types";

type Extends<A, B> = [A] extends [B] ? true : false;
type Assert<T extends true> = T;

/** Helper events whose type the Dev view handles. */
type Read = Extract<H.HelperEvent, { type: DevEvent["type"] }>;

// Helper → app: every event type the store handles must arrive in the shape it expects.
export type HelperToApp = [
  Assert<Extends<H.AgentSession, AgentSession>>,
  Assert<Extends<H.DevServer, DevServer>>,
  Assert<Extends<H.CiRun, CiRun>>,
  Assert<Extends<H.ProjectInfo, LiveProject>>,
  Assert<Extends<H.GitPayload, GitInfo>>,
  Assert<Extends<H.PingInfo, Ping>>,
  Assert<Extends<H.Snapshot["pings"], Ping[] | undefined>>,
  // service.upsert payloads are unknown on the wire; the store checks them at runtime.
  Assert<Extends<Exclude<Read, { type: "snapshot" }>, DevEvent>>,
  Assert<Extends<DevEvent["type"], Read["type"]>>,
];

// App → helper: every request the app sends must be one the helper accepts.
export type AppToHelper = Assert<Extends<DevRequest, H.HelperRequest>>;
