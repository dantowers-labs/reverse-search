import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

const PADDING_CLASSES = { md: "p-5", sm: "p-3.5" } as const;
// No mid-grey option, by design (change order v2, §5 amendment): a fill
// means "this is captured material" — everything else groups via the 1px
// divider grid it already sits in, not a background.
// Both tones must still be OPAQUE (matching the page for ground, a subtle
// tint for captured) — CardGrid paints its own container in --color-divider
// so its 2px gaps read as a rule, and a transparent card lets that same dark
// wash bleed through the whole card face instead of just the gap.
const TONE_CLASSES = { ground: "bg-bg", captured: "bg-cool-tint" } as const;

export function Card({
  children,
  className = "",
  onClick,
  padding = "md",
  tone = "ground",
}: {
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  padding?: keyof typeof PADDING_CLASSES;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <div className={`${TONE_CLASSES[tone]} ${PADDING_CLASSES[padding]} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

// The mockup's recurring pattern: a grid of cards over a divider-colored
// background, so the 2px gap itself reads as a rule between tiles.
export function CardGrid({
  children,
  columns = 3,
  className = "",
  style,
}: {
  children: ReactNode;
  columns?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`grid gap-[2px] bg-divider ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, ...style }}
    >
      {children}
    </div>
  );
}
