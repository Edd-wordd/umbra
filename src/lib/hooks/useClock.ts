"use client";

import { useSyncExternalStore } from "react";

/** Subscribes to a ticker aligned to the top of each minute. */
function subscribe(onTick: () => void): () => void {
  let interval: ReturnType<typeof setInterval> | undefined;
  const timeout = setTimeout(() => {
    onTick();
    interval = setInterval(onTick, 60_000);
  }, 60_000 - (Date.now() % 60_000) + 50);
  const onVisible = () => document.visibilityState === "visible" && onTick();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearTimeout(timeout);
    if (interval) clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

const getSnapshot = () => Math.floor(Date.now() / 60_000) * 60_000;
const getServerSnapshot = () => null;

/** Current time floored to the minute (null during SSR / before hydration). */
export function useMinuteClock(): Date | null {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return ms === null ? null : new Date(ms);
}
