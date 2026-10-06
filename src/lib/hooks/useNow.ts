"use client";

import { useSyncExternalStore } from "react";

/** Ticks once per second while subscribed (only the Dev focus uses it). */
function subscribe(onTick: () => void): () => void {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const getSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
const getServerSnapshot = () => 0;

/** Current time floored to the second (0 during SSR). */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
