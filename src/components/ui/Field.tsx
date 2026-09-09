import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs text-[color-mix(in_srgb,var(--color-text)_70%,transparent)] mb-[5px]">
        {label}
      </label>
      {children}
    </div>
  );
}

const CONTROL_CLASSES =
  "w-full rounded-none border border-divider bg-surface min-h-9 px-2.5 py-1.5 text-sm text-text placeholder:text-neutral-500 hover:border-[color-mix(in_srgb,var(--color-text)_45%,transparent)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0 focus-visible:border-accent";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${CONTROL_CLASSES} ${className}`} {...rest} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={`${CONTROL_CLASSES} min-h-[90px] resize-y ${className}`} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return (
    <select
      className={`${CONTROL_CLASSES} appearance-none bg-no-repeat pr-7 ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(45deg, transparent 50%, var(--color-text) 50%), linear-gradient(135deg, var(--color-text) 50%, transparent 50%)",
        backgroundPosition: "calc(100% - 15px) 15px, calc(100% - 10px) 15px",
        backgroundSize: "5px 5px, 5px 5px",
      }}
      {...rest}
    />
  );
}
