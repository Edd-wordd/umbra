"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * One-shot glitch (~210 ms) whenever `key` changes after mount, e.g. an item
 * turning red or a panel opening. Attach the returned ref to the element; the
 * class is added and removed on the DOM node directly (no re-render).
 * Never continuous; nothing under prefers-reduced-motion.
 */
export function useGlitch<T extends HTMLElement>(key: unknown, cls = "umbra-glitch") {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (reduced || !el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation
    el.classList.add(cls);
    const t = setTimeout(() => el.classList.remove(cls), 240);
    return () => {
      clearTimeout(t);
      el.classList.remove(cls);
    };
  }, [key, reduced, cls]);
  return ref;
}
