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
        className="group absolute bottom-[35px] left-10 flex items-center gap-[10px]"
        aria-label="open command palette"
      >
        <span className="flex h-[17px] w-[28px] items-center justify-center border border-ghost text-[9px] text-dim group-hover:border-mid group-hover:text-ink">
          ⌘K
        </span>
        <span className="label text-ghost group-hover:text-dim">COMMAND</span>
      </button>

      {mode !== "voice" && (
        <div className="absolute bottom-[30px] left-1/2 w-[360px] -translate-x-1/2" aria-label="focus">
          <div className="flex items-baseline">
            <span className="label text-dim">FOCUS</span>
            <span className="label ml-[22px] text-ink">WIREFRAME REVIEW</span>
            <span className="label ml-auto tabular-nums text-mid">00:42</span>
          </div>
          {/* Solid white progress bar on a hairline track. */}
          <div className="relative mt-[9px] h-[2px]">
            <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
            <div className="absolute inset-y-0 left-0 w-[28%] bg-active/85" />
          </div>
        </div>
      )}

      <div className="absolute bottom-[37px] right-[104px] flex gap-[18px]" aria-label="comms">
        <span className="label text-dim">COMMS</span>
        <span className="label text-mid">02 UNREAD</span>
        <span className="label text-ghost">00 URGENT</span>
      </div>
    </div>
  );
}
