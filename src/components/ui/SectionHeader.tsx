import type { ReactNode } from "react";

// v2 colour discipline: zone 01 (captured material) reads in the cool color,
// 02 (model analysis) in neutral, 03 (do next) in accent — accent used to be
// on every kicker regardless of zone, which is the exact bug the design
// change order calls out ("made everything look urgent"). Every call site
// already starts its eyebrow "01 —" / "02 —" / "03 —" (or a WHAT WE
// HOLD/READ / MAPPING variant for 01/02), so this is detected here rather
// than passed in — zero call-site changes needed to fix every header at once.
// A non-numbered eyebrow (e.g. chat's "GROUNDED IN") falls back to neutral.
function zoneStyle(eyebrow: string): { text: string; border: string } {
  if (/^0?1\b/.test(eyebrow)) return { text: "text-cool", border: "border-cool" };
  if (/^0?3\b/.test(eyebrow)) return { text: "text-accent", border: "border-accent" };
  return { text: "text-neutral-600", border: "border-divider" };
}

// The recurring "01 — CAPTURED / Section title" pattern that opens every
// numbered section across the redesigned screens.
export function SectionHeader({
  eyebrow,
  title,
  meta,
  className = "",
}: {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  className?: string;
}) {
  const { text, border } = zoneStyle(eyebrow);
  return (
    <div className={`flex items-baseline gap-3.5 border-b-2 ${border} pb-2 mb-5 ${className}`}>
      <span className={`font-mono text-[10px] tracking-[0.16em] ${text}`}>{eyebrow}</span>
      <h3 className="m-0 text-xl">{title}</h3>
      {meta != null && <div className="ml-auto text-xs text-neutral-700">{meta}</div>}
    </div>
  );
}
