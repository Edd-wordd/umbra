"use client";

import { useEffect } from "react";

export default function DebugScrollRoot({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => {
      history.scrollRestoration = previous;
    };
  }, []);

  return <main className="h-screen overflow-y-auto bg-[#050607] p-8 text-[#d7e4e8]">{children}</main>;
}
