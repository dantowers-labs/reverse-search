// Pulled directly from the v2 prototype's own JS (not approximated from prose)
// — a fit score is a magnitude, not a warning. A low score renders as a
// smaller/lighter number, not urgent red; red is reserved for "needs you."
export function getScoreInk(score: number): string {
  if (score >= 75) return "#201e1d";
  if (score >= 60) return "#4d4744";
  if (score >= 45) return "#857e7a";
  return "#b5aeaa";
}
