import type { ReactNode } from "react";

// Custom dot, not a native OS radio — the design system is explicit that
// interactive states are themed, never browser defaults.
export function Radio({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="absolute opacity-0 w-0 h-0 pointer-events-none peer" />
      <span
        className={`w-4 h-4 flex-none rounded-full border-[1.5px] transition-colors ${
          checked ? "border-accent bg-accent shadow-[inset_0_0_0_4px_var(--color-bg)]" : "border-divider"
        }`}
      />
      <span>{children}</span>
    </label>
  );
}

// The period-selector control (7 days / 30 days / All time): a row of
// button-styled radio options rather than a plain radio list.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex border border-divider">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-heading font-extrabold ${i > 0 ? "border-l border-divider" : ""} ${
            value === opt.value
              ? "bg-accent text-bg"
              : "bg-transparent text-text hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
