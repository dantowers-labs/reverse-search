"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type RunActivity =
  | "analyzeCompany"
  | "analyzeJobFit"
  | "importJobPosting"
  | "generateSuggestions"
  | "extractPerson"
  | "extractPeopleBulk"
  | "captureSharedConnections"
  | "candidateProfileIngest"
  | "candidateProfileApply"
  | "importTracker"
  | "importConnections"
  | "generateInterviewGuide";

export interface ActiveRun {
  id: string;
  activity: RunActivity;
  label: string;
  detail?: string;
  startedAt: number;
}

export interface CompletedRun {
  id: string;
  label: string;
  href?: string;
  cta?: string;
  isError?: boolean;
}

interface RunStatusContextValue {
  activeRun: ActiveRun | null;
  completedRun: CompletedRun | null;
  start: (activity: RunActivity, label: string, detail?: string) => string;
  updateDetail: (runId: string, detail: string) => void;
  complete: (runId: string, label: string, href?: string, cta?: string) => void;
  fail: (runId: string, message: string) => void;
  dismissCompleted: () => void;
}

const RunStatusContext = createContext<RunStatusContextValue | null>(null);

// Global, route-independent status: mounted once in the root layout so an
// in-flight (or just-finished) LLM call keeps reporting status even if the
// user navigates to another tab mid-run. Deliberately no fake progress
// percentage — real elapsed time only, since an LLM call has no meaningful
// "% complete".
export function RunStatusProvider({ children }: { children: ReactNode }) {
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [completedRun, setCompletedRun] = useState<CompletedRun | null>(null);
  const counter = useRef(0);

  const start = useCallback((activity: RunActivity, label: string, detail?: string) => {
    const id = `run-${++counter.current}-${activity}`;
    setActiveRun({ id, activity, label, detail, startedAt: Date.now() });
    setCompletedRun(null);
    return id;
  }, []);

  const updateDetail = useCallback((runId: string, detail: string) => {
    setActiveRun((current) => (current?.id === runId ? { ...current, detail } : current));
  }, []);

  const complete = useCallback((runId: string, label: string, href?: string, cta?: string) => {
    setActiveRun((current) => (current?.id === runId ? null : current));
    setCompletedRun({ id: runId, label, href, cta });
  }, []);

  const fail = useCallback((runId: string, message: string) => {
    setActiveRun((current) => (current?.id === runId ? null : current));
    setCompletedRun({ id: runId, label: message, isError: true });
  }, []);

  const dismissCompleted = useCallback(() => setCompletedRun(null), []);

  const value = useMemo(
    () => ({ activeRun, completedRun, start, updateDetail, complete, fail, dismissCompleted }),
    [activeRun, completedRun, start, updateDetail, complete, fail, dismissCompleted],
  );

  return <RunStatusContext.Provider value={value}>{children}</RunStatusContext.Provider>;
}

export function useRunStatus() {
  const ctx = useContext(RunStatusContext);
  if (!ctx) throw new Error("useRunStatus must be used within a RunStatusProvider");
  return ctx;
}
