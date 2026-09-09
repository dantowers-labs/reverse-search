import type { ReactNode } from "react";

// Top-level page header: "COMPANY PROJECTS / Five companies under analysis"
export function PageHeader({
  eyebrow,
  title,
  subcopy,
  actions,
}: {
  eyebrow: string;
  title: string;
  subcopy?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end gap-5 mb-8">
      <div>
        <div className="font-mono text-[10px] tracking-[0.16em] text-accent mb-2.5">{eyebrow}</div>
        <h1 className="text-[42px] m-0 leading-tight tracking-tight">{title}</h1>
        {subcopy != null && <div className="text-sm text-neutral-700 mt-1.5">{subcopy}</div>}
      </div>
      {actions != null && <div className="ml-auto flex gap-2">{actions}</div>}
    </div>
  );
}
