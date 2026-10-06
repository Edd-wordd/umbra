import { defineService, notConnected } from "./types";

export interface PosthogPayload {
  project: string;
  pageviews24h: number;
  /** % change vs 7-day average. */
  deltaVs7d: number;
  /** Pageviews per day, oldest first. */
  trend: number[];
  form: { name: string; submits24h: number; errors24h: number };
  topPage: { path: string; share: number };
}

export const posthog = defineService<PosthogPayload>({
  id: "posthog",
  label: "posthog",
  chip: "P",
  blurb: "pageviews, blips vs 7d, form conversions",
  read(p) {
    if (!p) return notConnected("PostHog");
    const blip = Math.abs(p.deltaVs7d) >= 25;
    const delta = `${p.deltaVs7d >= 0 ? "▲ +" : "▼ "}${p.deltaVs7d}% vs 7d`;
    return {
      status: p.form.errors24h ? "broken" : blip ? "attention" : "ok",
      // A traffic spike is worth an amber chip, not a to-do; form errors are.
      fyi: !p.form.errors24h,
      summary: p.form.errors24h
        ? `${p.form.errors24h} form errors · 24h`
        : blip
          ? `views ${delta.replace(" vs 7d", "")}`
          : `${p.pageviews24h.toLocaleString("en-US")} views · 24h`,
      spark: p.trend,
      rows: [
        { k: "pageviews", v: `${p.pageviews24h.toLocaleString("en-US")} · ${delta}`, tone: blip ? "attention" : undefined },
        { k: "form", v: `${p.form.submits24h} submits · ${p.form.errors24h} err · ${p.form.name}`, tone: p.form.errors24h ? "broken" : undefined },
        { k: "top page", v: `${p.topPage.path} · ${p.topPage.share}%` },
      ],
      actions: [{ label: "open insights ↗", toolId: "dev.link.open", args: { label: `posthog ${p.project}` } }],
    };
  },
});
