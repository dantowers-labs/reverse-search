// Confirmed fixed vocabulary (design change order v2, "As built" section) —
// the timeline's dot weight is derived from this, and free text cannot drive
// a visual, so this is a real enum in practice even though it's stored as a
// plain string column (this app's established convention for status fields).
export const INTERVIEW_ROUND_STATES = ["NOT_SCHEDULED", "IN_PROGRESS", "COMPLETE", "PASSED_OVER"] as const;
export type InterviewRoundState = (typeof INTERVIEW_ROUND_STATES)[number];

export const INTERVIEW_ROUND_STATE_LABELS: Record<InterviewRoundState, string> = {
  NOT_SCHEDULED: "Not scheduled",
  IN_PROGRESS: "In progress",
  COMPLETE: "Complete",
  PASSED_OVER: "Passed over",
};

// Two live states (need you, render large/accent) and two closed ones
// (history, render small/neutral) — anything not yours to act on is history.
export function isLiveRoundState(state: string | null): boolean {
  return state === "NOT_SCHEDULED" || state === "IN_PROGRESS" || state == null;
}
