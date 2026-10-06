import { defineService, notConnected } from "./types";

export interface SentryIssue {
  id: string;
  title: string;
  count24h: number;
  firstSeen: string;
  excerpt: string[];
}

export interface SentryPayload {
  org: string;
  project: string;
  issues: SentryIssue[];
}

export const sentry = defineService<SentryPayload>({
  id: "sentry",
  label: "sentry",
  chip: "S",
  blurb: "new issues, counts, stack excerpt, CI match",
  read(p, ctx) {
    if (!p) return notConnected("Sentry");
    if (!p.issues.length) return { status: "ok", summary: "no new issues · 24h", rows: [{ k: "project", v: `${p.org}/${p.project}` }] };
    const top = p.issues[0];
    const total = p.issues.reduce((n, i) => n + i.count24h, 0);
    const linked = ctx.ci.find((r) => r.repo === ctx.project.repo && r.status === "failed" && p.issues.some((i) => i.id === r.sentryId));
    return {
      status: "attention",
      summary: `${p.issues.length} issues · ×${total} in 24h`,
      needs: [
        {
          tone: "attention",
          state: "ISSUE",
          text: `${top.id} ×${top.count24h} · ${top.title.split(":")[0]}`,
          refs: p.issues.map((i) => i.id),
          action: { label: `open ${top.id} ↗`, toolId: "dev.link.open", args: { label: `sentry ${top.id}` } },
        },
      ],
      rows: [
        ...p.issues.map((i, n) => ({ k: i.id, v: `${i.title} · ×${i.count24h}`, tone: n === 0 ? ("attention" as const) : undefined })),
        ...(linked ? [{ k: "ci link", v: `${linked.sentryId} matches ci #${linked.number} failure · likely one fix`, tone: "attention" as const }] : []),
      ],
      excerpt: [...top.excerpt, `${p.project}.app · first seen ${top.firstSeen} · ×${top.count24h} in 24h`],
      wide: true,
      actions: [{ label: `open ${top.id} ↗`, toolId: "dev.link.open", args: { label: `sentry ${top.id}` } }],
    };
  },
});
