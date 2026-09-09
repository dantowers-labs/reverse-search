import type { CandidateProfileData } from "@/lib/schemas";

// Free, rule-based reads on the candidate profile — no LLM call. The
// semantic "how does this profile read" judgment (the mockup's third card)
// is deliberately not attempted here; that's real analysis work, not a
// pattern match, and belongs in chat where it can be grounded in a full
// company/role context instead of the profile in isolation.
const QUANTIFIED_OUTCOME_PATTERN = /(\$[\d,.]+\s*[kKmMbB]?|\d+(\.\d+)?%|\b\d{2,}\+?\s*(clients|deals|engagements|accounts))/i;

export function countQuantifiedOutcomes(experience: CandidateProfileData["experience"]): number {
  return experience.filter((e) => QUANTIFIED_OUTCOME_PATTERN.test(e.description)).length;
}

export function countCertificationLikeEntries(education: CandidateProfileData["education"]): number {
  return education.filter((e) => /certif/i.test(e.degree) || /certif/i.test(e.institution)).length;
}
