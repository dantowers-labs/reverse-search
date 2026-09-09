import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { RoleFitAnalysisSchema, type CandidateProfileData } from "@/lib/schemas";
import { recordApiCall } from "@/lib/usageTracking";
import { findConnectionsAtCompany } from "@/lib/connectionMatching";

export async function analyzeJobFit(jobPostingId: number) {
  const jobPosting = await prisma.jobPosting.findUniqueOrThrow({ where: { id: jobPostingId } });
  const company = await prisma.company.findUniqueOrThrow({ where: { id: jobPosting.companyId } });

  const candidateProfile = await prisma.candidateProfile.findFirst();
  if (!candidateProfile) {
    throw new Error("No candidate profile set up yet — add a resume or LinkedIn export at /candidate-profile");
  }
  const candidateData: CandidateProfileData = JSON.parse(candidateProfile.dataJson);

  const latestRun = await prisma.analysisRun.findFirst({
    where: { companyId: jobPosting.companyId },
    orderBy: { createdAt: "desc" },
    include: { clusters: true },
  });

  const people = await prisma.personProfile.findMany({ where: { companyId: jobPosting.companyId } });
  const peopleForPrompt = people.map((p, index) => ({
    index,
    name: p.mergedName, // best-effort, often null — see targetPersonIndex guidance below
    title: p.mergedTitle,
    headline: p.mergedHeadline,
    sharedConnections: p.sharedConnectionsJson
      ? (JSON.parse(p.sharedConnectionsJson) as { name: string; headline: string | null }[])
      : null,
  }));
  const warmPathCount = peopleForPrompt.filter((p) => p.sharedConnections && p.sharedConnections.length > 0).length;
  const directConnections = await findConnectionsAtCompany(company.name);
  const clustersForPrompt = (latestRun?.clusters ?? []).map((c, index) => ({
    index,
    label: c.clusterLabel,
    fitVerdict: c.fitVerdict,
    divergenceReasoning: c.divergenceReasoning,
  }));

  const response = await anthropic.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    output_config: { format: zodOutputFormat(RoleFitAnalysisSchema), effort: "high" },
    messages: [
      {
        role: "user",
        content: `Assess this candidate's fit for a specific job posting, and help them figure out how to get in the door.

Candidate profile (their actual background):
${JSON.stringify(candidateData, null, 2)}

${company.researchNotes ? `The candidate's own history/context with ${company.name}, in their own words — weigh this as real signal (it may explain past outcomes, current priority, or suggest a different approach than a cold one):\n${company.researchNotes}\n` : ""}
Job posting at ${company.name}:
Title: ${jobPosting.title}
Seniority: ${jobPosting.seniority}
Function type: ${jobPosting.functionType}
Key responsibilities: ${jobPosting.keyResponsibilitiesJson}
Required experience: ${jobPosting.requiredExperienceJson}
${jobPosting.applicationStatus ? `Application status: ${jobPosting.applicationStatus}` : "Not yet applied."}

${
  latestRun
    ? `Existing "birds of a feather" analysis of people captured at ${company.name} (use this to ground outreach targeting and to mirror how people there actually describe themselves):
${JSON.stringify(
  {
    overallVerdict: latestRun.overallVerdict,
    overallSummary: latestRun.overallSummary,
    clusters: latestRun.clusters.map((c) => ({
      label: c.clusterLabel,
      summary: c.aggregateSummary,
      fitVerdict: c.fitVerdict,
      divergenceReasoning: c.divergenceReasoning,
    })),
  },
  null,
  2,
)}`
    : `No people captured at ${company.name} yet — base outreach targeting on the job posting alone, and note in outreachTargets that capturing a few LinkedIn profiles there would sharpen this.`
}

People captured at ${company.name}, with mutual-connections data where the candidate has grabbed it (a LinkedIn profile export never includes this — it's a separate, optional capture per person; most won't have it, and that's expected, not a gap to apologize for):
${JSON.stringify(peopleForPrompt, null, 2)}
${warmPathCount > 0 ? `${warmPathCount} of ${people.length} captured people have a confirmed mutual-connections path.` : people.length > 0 ? "None of the captured people have mutual-connections data yet — outreach targeting below is title/cluster-based only." : ""}

${
  directConnections.length > 0
    ? `The candidate's own LinkedIn network (loosely matched on company name, so treat as a strong lead, not a guaranteed match) includes these people at ${company.name}. Each carries "predatesProject": true when the connection was made before this company was opened as a project here (${company.createdAt.toISOString().slice(0, 10)}), false when it was made after, null when the connection date isn't known. A "predatesProject": true connection is a genuine pre-existing relationship and outranks everyone else as an outreach target, including captured people with a mutual-connections path. A "predatesProject": false connection is NOT validated rapport — it was very likely formed as a result of this search (an outreach reply, a connection request sent while researching), not evidence the candidate already knew this person. Still worth surfacing, but say so explicitly in "reasoning" rather than treating it with the same confidence as a pre-existing relationship, and do not let a recently-formed connection outrank an older, real one just because it's 1st-degree:
${JSON.stringify(
  directConnections.map((c) => ({
    ...c,
    connectedOn: c.connectedOn,
    predatesProject: c.connectedOn ? c.connectedOn < company.createdAt : null,
  })),
  null,
  2,
)}`
    : ""
}

None of the text fields below should ever reference internal bookkeeping — an index number, a
list position, "person #N", "Index 0", or similar (the "index"/"targetPersonIndex" fields exist
purely to resolve a database ID afterward, never to be echoed in prose). Every text field is
prose a reader will see with zero other context; write each as a finished sentence.

Task — this candidate's resume currently reads as presales/solutions-consulting (demo environments, ROI frameworks, deal narratives, revenue attribution), and some roles they're a genuine capability fit for are framed as advisory or delivery-consulting instead. Your job is to catch that gap, not paper over it:

1. "verdict": ONE STANDALONE SENTENCE, max ~110 characters, written to stand alone with nothing else around it (this is rendered directly on the collapsed posting row) — the specific fit or mismatch, blunt, never hedges, couldn't apply to a different posting (e.g. "Quota-carrying closing seat. Same enterprise motion, wrong grammatical voice.").
2. "functionTypeAssessment": name plainly whether this role's actual function (${jobPosting.functionType}) matches how the candidate's resume currently reads, or whether there's a framing mismatch — and if so, exactly what kind (e.g. "this role wants delivery/program ownership language; the resume reads as deal-closing/presales language — same underlying skill, different vocabulary").
3. "associatedClusterIndex"/"associatedClusterBasis": ${
      clustersForPrompt.length > 0
        ? `which cluster below (by "index") this posting best maps to — score it against the cluster's own fit pattern when the posting's function type clearly lines up with a cluster's work, or fall back to a function/title-level match if nothing scores cleanly; set "associatedClusterBasis" to state plainly which of those two you used (e.g. "scored against cluster" or "function/title match"). Set "associatedClusterIndex": null and "associatedClusterBasis": null only when no cluster is a reasonable fit — don't force a weak association. Clusters: ${JSON.stringify(clustersForPrompt, null, 2)}`
        : `set both to null — no clusters exist yet for this company.`
    }
4. "positioningGaps": concrete, specific changes to how they should frame their background FOR THIS ROLE — not generic resume advice. For each gap, set "screenerVisible": true only if it's something an actual resume screener would see in ~6 seconds — title, a keyword, a structural framing choice, years/seniority signal. Set it false for anything that only matters once a human is actually evaluating them — a deeper capability question, a nuance that needs explaining, something that would come up in conversation but isn't visible on the page. An axis that can't be seen on a resume can't be why they got screened out, so don't inflate the screener-visible set just to pad it — a gap belongs there only if a skim would actually catch it. If the associated cluster (below) carries a "divergenceReasoning", treat it as a primary, already-identified candidate for a gap here — it's the concrete, specific way this company's real hiring pattern differs from the candidate, so don't ignore it in favor of a more generic framing point.
5. "likelyRejectionReason": if applicationStatus indicates a rejection (especially a fast one), give a grounded, specific read on why — a same-day rejection is almost always a keyword/framing skim, not a considered evaluation, so say so if the evidence supports it. If not yet applied, give a readiness read instead. When the associated cluster has a real "divergenceReasoning", it's often the single most concrete, honest explanation available — lead with it rather than a vaguer, more generic read when it applies.
6. "outreachTargets": 1-2 targets MAXIMUM — pick only the strongest, don't list every plausible option. Ranked in this order of strength:
   a. A direct 1st-degree connection from the candidate's own network with "predatesProject": true (listed above, if any) — set "warmPath": true, "targetPersonIndex": null (they're not a captured profile), and use their real name confidently in "reasoning" — this is the candidate's own pre-existing relationship, the strongest possible opener. A connection with "predatesProject": false is not this tier — it ranks with or below (b), and "reasoning" must say plainly that it was formed during this search rather than implying prior rapport.
   b. A captured person with a confirmed mutual-connections path — set "warmPath": true, "targetPersonIndex" to their "index" from the people list above, and name the specific mutual connection in the reasoning as the natural opener.
   c. Otherwise, reference real role-cluster types from the analysis above if available, or plausible functions/titles from the posting if not — set "warmPath": false and "targetPersonIndex": null for these unless a specific captured person (without a mutual connection) is still the clear best target, in which case still set their index.
   Name capture on captured profiles is best-effort — some have a "name" and some have it null (the screenshot didn't show it or was malformed). When a captured target's name is present, use it naturally. When targetPersonIndex points at someone with no name, say so explicitly in "reasoning" (e.g. "name wasn't captured in this screenshot") and only make them the lead target if they're genuinely the strongest option — don't promote an unnamed profile over a named, otherwise-comparable one just because more is known about them. If an unnamed profile IS the best target, tell the candidate plainly that they'll need to reopen that captured screenshot/profile themselves to identify who it is before reaching out.
7. "outreachMessages": exactly one entry per "outreachTargets" item, same order — each entry has 1-2 "variants":
   - Always include a "direct" variant: short and punchy, 2-3 sentences, no generic flattery ("I'd love to connect!"), no restating their whole resume. Lead with one specific, credible point of relevance and end with a clear, low-friction ask.
   - Only ALSO include a "personal" variant when there's real grounding for warmth — a warm-path target (open through the named mutual connection) or another genuinely specific shared thread from the data (same cluster, same prior company, an explicit note in the reasoning). A "personal" variant can run a sentence or two longer and open more conversationally, but it still has to be grounded in something real — never manufacture warmth toward a stranger just to fill the slot. For a cold target with no such grounding, "direct" is the only variant — do not force a fake-personal version.
   - Only address a message by name if the target's name is actually known (a direct connection's name always is; a captured profile's name is best-effort) — otherwise write it addressable by role ("Hi — I saw your team is hiring for...") rather than inventing or guessing a name.
8. "resumeEdits": 2-4 concrete rewrite instructions specific to this posting, each with a "targetField" naming where it applies (e.g. "IDENTITY · HEADLINE", "EXPERIENCE · 2 ENTRIES", "SKILLS · PRIMARY").
9. "skillsToAcquire": 1-3 skills, certifications, or artefacts worth acquiring to close the gap, each with a one-sentence "rationale" grounded in the captured profiles when possible (e.g. "N of M captured profiles hold one, you hold none").
10. "coldOutreachToHiringManager": a separate, ready-to-send template for reaching out directly to this role's actual hiring manager, for when the candidate identifies who that is themselves (outside this app — a LinkedIn search, the company site, wherever). This is a different kind of message than the outreachMessages above: there's no specific person's background to lean on, so it can't work the same way. Address it to "[Hiring Manager Name]" as a literal placeholder for the candidate to fill in, and instead of personal grounding, demonstrate real, specific awareness of THIS ROLE's and THIS COMPANY's actual challenges or opportunities — grounded in the job posting's responsibilities/requirements and, when available, the company's captured-people cluster analysis and any research notes provided — and make a sharp, concrete case for how the candidate's specific experience addresses that gap. No generic "I'd be a great fit" language. Under ~150 words, one clear, low-friction ask.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Role-fit analysis did not parse");
  }
  const result = response.parsed_output;

  const outreachTargetsWithPersonIds = result.outreachTargets.map((t) => ({
    targetType: t.targetType,
    reasoning: t.reasoning,
    warmPath: t.warmPath,
    targetPersonId: t.targetPersonIndex != null ? (people[t.targetPersonIndex]?.id ?? null) : null,
  }));

  const clusters = latestRun?.clusters ?? [];
  const associatedClusterId =
    result.associatedClusterIndex != null ? (clusters[result.associatedClusterIndex]?.id ?? null) : null;

  const priorAnalysisCount = await prisma.jobPostingAnalysis.count({ where: { jobPostingId } });
  await recordApiCall({
    activity: "analyzeJobFit",
    model: CLAUDE_MODEL,
    usage: response.usage,
    companyId: jobPosting.companyId,
    jobPostingId,
    isRerun: priorAnalysisCount > 0,
  });

  return prisma.jobPostingAnalysis.create({
    data: {
      jobPostingId,
      fitScore: result.fitScore,
      verdict: result.verdict,
      functionTypeAssessment: result.functionTypeAssessment,
      associatedClusterId,
      associatedClusterBasis: associatedClusterId != null ? result.associatedClusterBasis : null,
      positioningGapsJson: JSON.stringify(result.positioningGaps),
      likelyRejectionReason: result.likelyRejectionReason,
      outreachTargetsJson: JSON.stringify(outreachTargetsWithPersonIds),
      outreachMessagesJson: JSON.stringify(result.outreachMessages),
      coldOutreachToHiringManager: result.coldOutreachToHiringManager,
      resumeEditsJson: JSON.stringify(result.resumeEdits),
      skillsToAcquireJson: JSON.stringify(result.skillsToAcquire),
      personCountAtRun: people.length,
      candidateProfileUpdatedAt: candidateProfile.updatedAt,
    },
  });
}
