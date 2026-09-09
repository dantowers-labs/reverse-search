"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRunStatus } from "@/lib/runStatus/RunStatusContext";
import { PulsingDot } from "@/components/ui/Spinner";

function useElapsedSeconds(startedAt: number | undefined) {
  const [elapsed, setElapsed] = useState(() => (startedAt == null ? 0 : Math.round((Date.now() - startedAt) / 1000)));
  useEffect(() => {
    if (startedAt == null) return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return elapsed;
}

export function RunStatusBar() {
  const { activeRun, completedRun, dismissCompleted } = useRunStatus();
  const elapsed = useElapsedSeconds(activeRun?.startedAt);

  if (activeRun) {
    return (
      <div className="flex items-center gap-4 px-10 py-2.5 bg-accent text-bg">
        <PulsingDot className="bg-bg" />
        <span className="font-heading font-extrabold text-[13px] tracking-wide">{activeRun.label}</span>
        {activeRun.detail && <span className="text-[13px] opacity-90">{activeRun.detail}</span>}
        <span className="ml-auto font-mono text-[11px]">{elapsed}s</span>
      </div>
    );
  }

  if (completedRun) {
    return (
      <div className={`flex items-center gap-4 px-10 py-2.5 text-bg ${completedRun.isError ? "bg-accent" : "bg-neutral-900"}`}>
        <span className="font-mono text-[10px] tracking-[0.16em] border border-bg/40 px-1.5 py-1">
          {completedRun.isError ? "FAILED" : "COMPLETE"}
        </span>
        <span className="text-[13px]">{completedRun.label}</span>
        <div className="ml-auto flex gap-2">
          {completedRun.href && (
            <Link
              href={completedRun.href}
              onClick={dismissCompleted}
              className="bg-bg text-text px-3 py-1.5 font-heading font-extrabold text-xs no-underline"
            >
              {completedRun.cta ?? "View"}
            </Link>
          )}
          <button
            onClick={dismissCompleted}
            className="bg-transparent text-bg border border-bg/40 px-3 py-1.5 font-heading font-extrabold text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return null;
}
