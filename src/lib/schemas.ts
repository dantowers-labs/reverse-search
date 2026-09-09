import { z } from "zod";

// ---- Candidate profile (mirrors AI-Job-Search's 01-candidate-profile.md structure) ----

export const CandidateProfileDataSchema = z.object({
  identity: z.object({
    name: z.string(),
    headline: z.string().nullable(),
    location: z.string().nullable(),
  }),
  languages: z.array(z.object({ language: z.string(), level: z.string() })),
  education: z.array(
    z.object({ degree: z.string(), institution: z.string(), period: z.string() }),
  ),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      dates: z.string(),
      location: z.string().nullable(),
      description: z.string(),
    }),
  ),
  skills: z.object({
    primary: z.array(z.string()),
    secondary: z.array(z.string()),
    domain: z.array(z.string()),
    software: z.array(z.string()),
  }),
  targetCriteria: z.object({
    targetSectors: z.array(z.string()),
    dealBreakers: z.array(z.string()),
    compFloor: z.string().nullable(),
    relocation: z.string().nullable(),
  }),
});
export type CandidateProfileData = z.infer<typeof CandidateProfileDataSchema>;

// ---- Candidate document ingestion (resume/LinkedIn export/cover letter -> proposed changes) ----

export const CandidateDocExtractionSchema = z.object({
  identity: z.object({ location: z.string().nullable() }),
  languages: z.array(z.object({ language: z.string(), level: z.string() })),
  education: z.array(
    z.object({ degree: z.string(), institution: z.string(), period: z.string() }),
  ),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      dates: z.string(),
      location: z.string().nullable(),
      description: z.string(),
    }),
  ),
  skills: z.array(z.string()),
  summary: z.string().nullable(),
});
export type CandidateDocExtraction = z.infer<typeof CandidateDocExtractionSchema>;

export const ProfileChangeSetSchema = z.object({
  additive: z.array(
    z.object({
      field: z.string(),
      description: z.string(),
      value: z.string(),
    }),
  ),
  conflicting: z.array(
    z.object({
      field: z.string(),
      current: z.string(),
      proposed: z.string(),
      description: z.string(),
    }),
  ),
});
export type ProfileChangeSet = z.infer<typeof ProfileChangeSetSchema>;

// ---- Screenshot extraction (one LinkedIn profile image -> structured fields) ----

export const ScreenshotExtractionSchema = z.object({
  name: z.string().nullable(), // best-effort — null when not visible or the capture is malformed, never guessed
  title: z.string().nullable(),
  headline: z.string().nullable(),
  aboutText: z.string().nullable(),
  skills: z.array(z.string()),
  experienceBullets: z.array(z.string()),
  seniorityGuess: z.string().nullable(),
  // The earliest date shown under this employer — i.e. when they joined the
  // company, even if since promoted to a different title within it. Free
  // text ("2023-01", "2023") since LinkedIn rarely shows day precision;
  // parsed to a real date at persistence time (see approximateDate.ts). Null
  // when no date range is visible in this capture. Feeds a future
  // recency/tenure analysis, not used yet — see PersonProfile.companyTenureStartDate.
  companyTenureStartDate: z.string().nullable(),
  // LinkedIn's own degree badge near the person's name ("1st", "2nd", "3rd"
  // — beyond 3rd shows no badge at all, so that's null too, same as not
  // captured). Feeds a sample-composition signal (how much of a capture is
  // the candidate's own network vs.
  // genuinely further out), not a fit judgment — see PersonProfile.connectionDegree.
  connectionDegree: z.string().nullable(),
  // Company names from every OTHER experience entry on their profile — not
  // this company (that's already known), their prior employers. Best-effort
  // short names as LinkedIn shows them; empty array if none visible. Feeds a
  // shared-employer flag (candidate worked there too) computed in code by
  // comparing against CandidateProfileData.experience — no LLM judgment call
  // needed for the match itself, this just captures the raw names.
  priorEmployers: z.array(z.string()),
});
export type ScreenshotExtraction = z.infer<typeof ScreenshotExtractionSchema>;

// ---- Shared/mutual connections (a screenshot of LinkedIn's own "X mutual
// connections" panel for one captured person — not part of a profile export) ----

export const SharedConnectionsExtractionSchema = z.object({
  connections: z.array(
    z.object({
      name: z.string(), // the candidate's OWN connection, not the target person — their own network
      headline: z.string().nullable(),
    }),
  ),
});
export type SharedConnectionsExtraction = z.infer<typeof SharedConnectionsExtractionSchema>;

// ---- Merge of 1+ screenshot extractions for the same person ----

export const MergedPersonSchema = z.object({
  name: z.string().nullable(),
  title: z.string().nullable(),
  headline: z.string().nullable(),
  about: z.string().nullable(),
  skills: z.array(z.string()),
  companyTenureStartDate: z.string().nullable(),
  connectionDegree: z.string().nullable(),
  priorEmployers: z.array(z.string()),
});
export type MergedPerson = z.infer<typeof MergedPersonSchema>;

// ---- Company analysis (role clustering + fit scoring) ----

export const AnalysisResultSchema = z.object({
  // One standalone sentence, ~110 chars — names the specific fit/mismatch,
  // never hedges. Rendered directly on collapsed rows (the dashboard lead
  // headline), so it has to carry meaning with nothing else around it.
  overallVerdict: z.string(),
  overallScore: z.number().int().min(0).max(100),
  overallSummary: z.string(),
  confidenceNote: z.string(),
  openingMessage: z.string(),
  // Grouped under dynamic topic headings, not a flat list — a flat list of
  // ~10 questions is noise, grouping is what makes that many readable.
  // Topics are generated per company, not a fixed taxonomy (e.g. "the
  // seniority question", "where the analysis is thin", "preparing for
  // <interviewer>", "reading <company> as a company").
  suggestedQuestions: z.array(
    z.object({
      topic: z.string(),
      questions: z.array(z.string()).min(2).max(3),
    }),
  ).min(3).max(4),
  clusters: z.array(
    z.object({
      label: z.string(),
      memberIndices: z.array(z.number().int()),
      aggregateSummary: z.string(),
      fitScore: z.number().int().min(0).max(100),
      fitVerdict: z.string(), // same standalone-sentence standard as overallVerdict above
      // The pro/con split: alignmentReasoning is the concrete overlap case,
      // divergenceReasoning is the concrete, specific way this cluster's
      // real hiring pattern differs from the candidate — often the actual,
      // honest reason a rejection would make sense, not a hedge. Null only
      // when there genuinely isn't a real divergence to name — don't
      // manufacture one just to fill the field on a genuinely strong match.
      alignmentReasoning: z.string(),
      divergenceReasoning: z.string().nullable(),
    }),
  ),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// ---- Suggestions (recommendation engine over tracker companies) ----

export const SuggestionResultSchema = z.object({
  // Capped — the candidate pool this gets matched against can run into the
  // hundreds of tracker rows, and an unbounded array here previously let the
  // model try to return dozens of full-reasoning suggestions, blowing past
  // max_tokens and truncating mid-JSON (a paid call that then fails to parse).
  suggestions: z.array(
    z.object({
      companyName: z.string(),
      reasoning: z.string(),
      verdict: z.string(), // one standalone sentence, ~110 chars — same calibration as AnalysisResultSchema's verdicts
      basedOnPattern: z.string(),
      confidenceScore: z.number().int().min(0).max(100), // how strong the fit-pattern match is, for ranking/tiebreak
    }),
  ).max(8),
});
export type SuggestionResult = z.infer<typeof SuggestionResultSchema>;

// ---- Job postings (imported JD -> structured extraction) ----

export const JobPostingExtractionSchema = z.object({
  companyName: z.string(), // the actual hiring/brand name, e.g. "Merkle" not "Dentsu" when the posting is for a Dentsu brand
  title: z.string(),
  seniority: z.string(),
  functionType: z.string(), // e.g. "Presales / Solutions Consulting", "Advisory / Delivery Consulting", "Technical Architecture", "Account/Program Management"
  keyResponsibilities: z.array(z.string()),
  requiredExperience: z.array(z.string()),
  compensationRange: z.string().nullable(),
});
export type JobPostingExtraction = z.infer<typeof JobPostingExtractionSchema>;

// ---- Role-fit + outreach analysis for one job posting ----

export const ResumeEditSchema = z.object({
  suggestion: z.string(), // concrete rewrite instruction, e.g. "Reframe the headline to lead with solution consulting"
  targetField: z.string(), // where it applies, e.g. "IDENTITY · HEADLINE" or "EXPERIENCE · 2 ENTRIES"
});
export type ResumeEdit = z.infer<typeof ResumeEditSchema>;

export const SkillToAcquireSchema = z.object({
  title: z.string(), // e.g. "Named presales motion", "Cloud partner certification"
  rationale: z.string(), // why it matters, grounded in captured profiles when possible
});
export type SkillToAcquire = z.infer<typeof SkillToAcquireSchema>;

export const OutreachVariantSchema = z.object({
  tone: z.enum(["direct", "personal"]),
  message: z.string(),
});
export type OutreachVariant = z.infer<typeof OutreachVariantSchema>;

export const OutreachDraftSchema = z.object({
  variants: z.array(OutreachVariantSchema).min(1).max(2), // "personal" only included when there's real grounding for it — see prompt
});
export type OutreachDraft = z.infer<typeof OutreachDraftSchema>;

export const RoleFitAnalysisSchema = z.object({
  fitScore: z.number().int().min(0).max(100),
  verdict: z.string(), // one standalone sentence, ~110 chars — same calibration as AnalysisResultSchema's verdicts. Rendered on collapsed posting rows.
  functionTypeAssessment: z.string(), // names the gap (or lack of one) between how the candidate's profile currently reads and what this role's function actually is
  // Index into the prompt's cluster list (when the company has any) for the
  // cluster this posting best maps to; null when there are no clusters yet or
  // none is a good fit. Resolved to a real RoleCluster id post-hoc, same
  // pattern as targetPersonIndex below.
  associatedClusterIndex: z.number().int().nullable(),
  associatedClusterBasis: z.string().nullable(), // e.g. "scored against cluster" vs "function/title match"; null when associatedClusterIndex is null
  // Concrete resume/framing changes specific to this role's function type.
  // screenerVisible sorts by whether a resume screener would see the axis in
  // ~6 seconds (title, keywords, structure) vs. an axis that only surfaces
  // once you're already in the room — an axis that isn't screener-visible
  // can't be why you got screened out, so it's noise for THAT question and
  // only matters later, in interview prep. See prompt for the exact ask.
  positioningGaps: z.array(
    z.object({
      gap: z.string(),
      screenerVisible: z.boolean(),
    }),
  ),
  likelyRejectionReason: z.string(), // grounded, non-generic read on why a fast rejection likely happened if applicationStatus indicates one; otherwise a readiness note
  outreachTargets: z.array(
    z.object({
      targetType: z.string(), // e.g. "the Solutions Consulting cluster" or "whoever holds the Head of Data & AI Advisory Services title"
      reasoning: z.string(),
      warmPath: z.boolean(), // true when this target is grounded in a captured person who has a mutual connection
      targetPersonIndex: z.number().int().nullable(), // index into the prompt's people list when this target IS a specific captured person; null for cluster/title-level targets
    }),
  ).min(1).max(2), // capped to match outreachMessages below, which produces exactly one entry per target
  outreachMessages: z.array(OutreachDraftSchema).min(1).max(2), // one entry per outreachTargets[i], same order
  // Distinct from outreachMessages above — not grounded in a specific captured
  // person (there isn't one), so it uses a "[Hiring Manager Name]" placeholder
  // instead. See prompt for what it needs to demonstrate.
  coldOutreachToHiringManager: z.string(),
  resumeEdits: z.array(ResumeEditSchema),
  skillsToAcquire: z.array(SkillToAcquireSchema),
});
export type RoleFitAnalysis = z.infer<typeof RoleFitAnalysisSchema>;

// ---- Interview prep guide for one round of one interview opportunity ----

export const InterviewGuideSchema = z.object({
  interviewerContext: z.string(), // grounds the guide in who this person is, or says plainly it's generic if no profile is linked
  likelyFocusAreas: z.array(z.object({ theme: z.string(), why: z.string() })).min(3).max(6),
  anticipatedQuestions: z.array(z.object({ question: z.string(), prepGuidance: z.string() })).min(3).max(6),
  storiesToPrepare: z.array(z.object({ prompt: z.string(), candidateAngle: z.string() })).min(2).max(4),
  questionsToAskThem: z.array(z.string()).min(2).max(4),
  continuityNotes: z.string().nullable(), // what changed/should be addressed vs. prior rounds — null only for round 1
});
export type InterviewGuide = z.infer<typeof InterviewGuideSchema>;
