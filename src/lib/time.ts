/** Edward's desk lives in Denver; the console always shows Mountain Time. */
export const TIME_ZONE = "America/Denver";

const clockFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** "20:54" (24h, no seconds) */
export function formatClock(d: Date): string {
  return clockFmt.format(d);
}

/** "MON 05 OCT 2026 · MT" */
export function formatDateLine(d: Date): string {
  const p = Object.fromEntries(dateFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day} ${p.month} ${p.year} · MT`.toUpperCase();
}
