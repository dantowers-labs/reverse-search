import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="py-10 text-center">
      <div className="font-heading font-extrabold text-base mb-1.5">{title}</div>
      {description != null && <p className="text-sm text-neutral-700 max-w-md mx-auto mb-4">{description}</p>}
      {action}
    </div>
  );
}
