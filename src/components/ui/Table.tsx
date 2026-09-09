import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-sm ${className}`}>{children}</table>
    </div>
  );
}

export function Th({ children, className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`text-left text-[11px] tracking-[0.08em] uppercase font-normal text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] p-2 border-b-2 border-divider ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`p-2 border-b border-divider ${className}`} {...props}>
      {children}
    </td>
  );
}
