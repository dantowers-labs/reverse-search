import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "px-3.5 py-2 bg-accent text-bg border border-transparent hover:bg-accent-600 active:bg-accent-700",
  secondary:
    "px-3.5 py-2 bg-transparent text-text border border-divider hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] active:bg-[color-mix(in_srgb,var(--color-text)_14%,transparent)]",
  ghost:
    "px-1 py-2 bg-transparent text-accent border border-transparent hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] active:bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

export function Button({ variant = "primary", block, className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`font-heading font-extrabold text-xs rounded-none cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed transition-colors ${VARIANT_CLASSES[variant]} ${block ? "w-full justify-start text-left" : ""} ${className}`}
      {...props}
    />
  );
}
