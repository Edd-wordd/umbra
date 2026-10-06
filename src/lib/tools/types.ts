import type { DomainId } from "../graph";
import type { Mode } from "../store";
import type { RailId } from "../rails";

/**
 * One tool layer: every action is defined ONCE here and used by rail
 * buttons, voice (Phase 3) and the Cmd-K palette.
 *
 * - read:     safe, runs immediately
 * - confirm:  changes state; needs an explicit yes in the UI
 * - physical: moves or powers real hardware (mount, power, print); needs
 *             explicit approval and is subject to hard limits the AI can't override
 */
export type Risk = "read" | "confirm" | "physical";

export interface ToolContext {
  /** Who invoked it: logged with every action (activity log lands in Phase 2). */
  source: "touch" | "palette" | "voice";
  /** True once the user approved a confirm/physical tool. */
  approved: boolean;
  wakeRail: (id: RailId) => void;
  setMode: (mode: Mode) => void;
  toIdle: () => void;
}

export interface ToolResult {
  ok: boolean;
  message: string;
}

export interface Tool {
  /** Dotted id: <domain>.<noun>.<verb>, e.g. astro.mount.slew */
  id: string;
  domain: DomainId | "core";
  title: string;
  risk: Risk;
  /** Extra words for fuzzy matching (plain language). */
  keywords?: readonly string[];
  run: (ctx: ToolContext) => Promise<ToolResult>;
}
