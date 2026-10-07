/**
 * Project accent colors: a stable hash of the repo name into a small curated
 * palette that sits next to the cyberdeck's cyan / amber without competing.
 * Red, amber, green and pure cyan are left out on purpose: those mean status.
 * No imports: the app reuses this file (src/lib/dev/colors.ts) so a project
 * has the same color in pings and in the Dev focus.
 */
export interface Accent {
  name: string;
  hex: string;
  /** For notification titles (no red/orange/yellow/green circles). */
  emoji: string;
}

export const PALETTE: readonly Accent[] = [
  { name: "azure", hex: "#5aa9ff", emoji: "🔵" },
  { name: "iris", hex: "#8b93ff", emoji: "🔷" },
  { name: "violet", hex: "#b18cff", emoji: "🟣" },
  { name: "orchid", hex: "#df7cf0", emoji: "🟪" },
  { name: "rose", hex: "#ff7fb0", emoji: "🩷" },
  { name: "ice", hex: "#b9d3e8", emoji: "⚪" },
  { name: "clay", hex: "#c79a86", emoji: "🟤" },
];

/** FNV-1a (32-bit) of the repo folder name → palette slot. */
export function accentOf(repo: string): Accent {
  let h = 0x811c9dc5;
  for (const ch of new TextEncoder().encode(repo.toLowerCase())) {
    h ^= ch;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}
