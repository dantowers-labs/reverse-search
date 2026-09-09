import type { ReactNode } from "react";

type Variant = "neutral" | "accent" | "outline";

const VARIANT_CLASSES: Record<Variant, string> = {
  neutral: "bg-neutral-100 text-neutral-800",
  accent: "bg-accent-100 text-accent-800",
  outline: "bg-transparent border border-accent text-accent",
};

export function Tag({
  variant = "neutral",
  title,
  children,
}: {
  variant?: Variant;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center text-[11px] tracking-[0.02em] px-2.5 py-[3px] ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
