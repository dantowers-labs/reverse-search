import { useState, type ReactNode } from "react";

// Small hover-triggered info panel — CSS-only positioning, no portal, so it's
// fine for short explanatory text near where it's triggered.
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open && (
        <span className="absolute z-30 left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] w-64 bg-neutral-900 text-bg text-xs leading-relaxed p-3 pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}
