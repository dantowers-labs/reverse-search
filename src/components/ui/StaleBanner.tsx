import type { ReactNode } from "react";

// The accent-bordered callout used both for "OUT OF DATE" (cluster/action-plan
// panels whose underlying data changed since the run) and other short,
// actionable notices that deserve the same attention-getting treatment.
export function StaleBanner({ reason, action, label = "OUT OF DATE" }: { reason: ReactNode; action?: ReactNode; label?: string }) {
  return (
    <div className="flex items-start gap-3.5 border-2 border-accent px-4 py-3 mb-0.5">
      <span className="font-mono text-[10px] tracking-[0.14em] text-accent-700 pt-0.5">{label}</span>
      <span className="text-sm">{reason}</span>
      {action != null && <div className="ml-auto">{action}</div>}
    </div>
  );
}
