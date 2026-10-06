"use client";

import { useUmbra } from "@/lib/store";

/** Bottom chrome: ⌘K hint (left), Focus strip (center), Comms strip (right). SAMPLE values. */
export default function BottomStrips() {
  const mode = useUmbra((s) => s.mode);
  const openPalette = useUmbra((s) => s.openPalette);
  const dim = mode !== "idle";
  return (
    <div className="transition-opacity duration-300" style={{ opacity: dim ? 0.6 : 1 }}>
      <button
        type="button"
        onClick={() => openPalette()}
        className="group absolute bottom-[35px] left-10 flex items-center gap-[10px] text-[10px]"
        aria-label="open command palette"
      >
        <span className="flex h-[18px] w-[30px] items-center justify-center border border-ghost text-dim group-hover:border-dim">
          ⌘K
        </span>
        <span className="tracking-[1px] text-ghost group-hover:text-dim">command</span>
      </button>

      {mode !== "voice" && (
        <div className="absolute bottom-[30px] left-1/2 w-[360px] -translate-x-1/2" aria-label="focus">
          <div className="flex items-baseline text-[10px] leading-none">
            <span className="tracking-[2px] text-dim">FOCUS</span>
            <span className="ml-[22px] text-mid">wireframe review</span>
            <span className="ml-auto text-dim tabular-nums">00:42</span>
          </div>
          <div className="relative mt-[8px] h-px bg-line">
            <div className="absolute inset-y-0 left-0 w-[100px] bg-dim" />
          </div>
        </div>
      )}

      <div className="absolute bottom-[37px] right-[104px] flex gap-[22px] text-[10px] leading-none" aria-label="comms">
        <span className="tracking-[2px] text-dim">COMMS</span>
        <span className="text-dim">2 unread · 0 urgent</span>
      </div>
    </div>
  );
}
