// Shared by the Profiles and Job descriptions tabs: compares a run's snapshot
// fields against live counts to decide whether a StaleBanner should show, and
// what it should say. Derived at render time rather than stored as static
// text, so the numbers stay accurate as more people get captured.
export function getClusterStaleness(personCountAtRun: number, currentPersonCount: number) {
  if (currentPersonCount <= personCountAtRun) return { stale: false, reason: "" };
  const added = currentPersonCount - personCountAtRun;
  return {
    stale: true,
    reason: `${added} profile${added === 1 ? "" : "s"} ${added === 1 ? "was" : "were"} added after this analysis ran. Numbers below are from the ${personCountAtRun}-profile run.`,
  };
}

export function getPlanStaleness(
  personCountAtRun: number,
  currentPersonCount: number,
  candidateProfileUpdatedAtAtRun: string,
  currentCandidateProfileUpdatedAt: string | null,
) {
  if (currentCandidateProfileUpdatedAt && new Date(currentCandidateProfileUpdatedAt) > new Date(candidateProfileUpdatedAtAtRun)) {
    return { stale: true, reason: "Your candidate profile changed after this plan was written." };
  }
  if (currentPersonCount > personCountAtRun) {
    const added = currentPersonCount - personCountAtRun;
    return {
      stale: true,
      reason: `${added} more profile${added === 1 ? "" : "s"} captured since this plan was written.`,
    };
  }
  return { stale: false, reason: "" };
}
