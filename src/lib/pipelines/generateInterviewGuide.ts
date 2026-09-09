import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { InterviewGuideSchema, type CandidateProfileData } from "@/lib/schemas";
import { recordApiCall } from "@/lib/usageTracking";

export async function generateInterviewGuide(roundId: number, includeCrossOpportunityContext = true) {
  const round = await prisma.interviewRound.findUniqueOrThrow({
    where: { id: roundId },
    include: {
      interviewerPerson: true,
      interview: { include: { company: true, jobPosting: true } },
    },
  });
  const opportunity = round.interview;

  const candidateProfile = await prisma.candidateProfile.findFirst();
  if (!candidateProfile) {
    throw new Error("No candidate profile set up yet — add a resume or LinkedIn export at /candidate-profile");
  }
  const candidateData: CandidateProfileData = JSON.parse(candidateProfile.dataJson);

  const priorRounds = await prisma.interviewRound.findMany({
    where: { interviewId: opportunity.id, sequence: { lt: round.sequence } },
    orderBy: { sequence: "asc" },
  });

  let crossOpportunityDigest: { title: string; disposition: string; rounds: { stage: string; notes: string | null }[] }[] | null = null;
  if (includeCrossOpportunityContext) {
    const others = await prisma.interview.findMany({
      where: { companyId: opportunity.companyId, id: { not: opportunity.id } },
      include: { rounds: { orderBy: { sequence: "asc" } }, jobPosting: true },
    });
    const withNotes = others
      .map((o) => ({
        title: o.jobPosting?.title ?? o.label ?? "Unlabeled opportunity",
        disposition: o.disposition ?? "still in progress",
        rounds: o.rounds.filter((r) => r.notes).map((r) => ({ stage: r.stage, notes: r.notes })),
      }))
      .filter((o) => o.rounds.length > 0 || o.disposition !== "still in progress");
    if (withNotes.length > 0) crossOpportunityDigest = withNotes;
  }

  const interviewer = round.interviewerPerson;

  const response = await anthropic.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 6000,
    output_config: { format: zodOutputFormat(InterviewGuideSchema), effort: "high" },
    messages: [
      {
        role: "user",
        content: `Help this candidate prepare for one specific interview round. Ground everything in the actual data below — never invent details about the interviewer or the role beyond what's given.

Candidate profile (their actual background):
${JSON.stringify(candidateData, null, 2)}

${opportunity.company.researchNotes ? `The candidate's own history/context with ${opportunity.company.name}, in their own words — weigh this as real signal (it may explain past outcomes, current priority, or suggest a different approach than a cold one):\n${opportunity.company.researchNotes}\n` : ""}
${
  opportunity.jobPosting
    ? `Job posting at ${opportunity.company.name}:
Title: ${opportunity.jobPosting.title}
Seniority: ${opportunity.jobPosting.seniority}
Function type: ${opportunity.jobPosting.functionType}
Key responsibilities: ${opportunity.jobPosting.keyResponsibilitiesJson}
Required experience: ${opportunity.jobPosting.requiredExperienceJson}`
    : `No job posting is linked to this opportunity yet. Base prep on the opportunity's own label ("${opportunity.label ?? "unlabeled"}") and this round's stage alone — don't invent job requirements.`
}

This round:
Stage: ${round.stage}
Interviewer: ${round.interviewerName}
${
  interviewer
    ? `A profile has been captured for this interviewer — ground "interviewerContext" and the focus areas in it, don't just restate it:
${JSON.stringify(
  {
    name: interviewer.mergedName,
    title: interviewer.mergedTitle,
    headline: interviewer.mergedHeadline,
    about: interviewer.mergedAbout,
    skills: interviewer.mergedSkillsJson ? JSON.parse(interviewer.mergedSkillsJson) : null,
  },
  null,
  2,
)}`
    : `No captured profile is linked for this interviewer. Say so plainly in "interviewerContext" and keep the rest of the guide generic to the stage/role rather than inventing anything about this specific person.`
}

${
  priorRounds.length > 0
    ? `Prior rounds in THIS interview thread, in order — use these to avoid repeating ground already covered and to react to anything concerning or promising the candidate noted. This is the main thing that should make this guide different from a generic one for the same stage/role:
${JSON.stringify(priorRounds.map((r) => ({ stage: r.stage, interviewer: r.interviewerName, notes: r.notes ?? "(no notes logged)" })), null, 2)}`
    : `This is the first round in this thread — there's nothing to compound from yet, so "continuityNotes" should be null.`
}

${
  crossOpportunityDigest
    ? `Secondary signal — other interview threads the candidate has had at ${opportunity.company.name} (different opportunities, possibly different roles or times). Weight this BELOW the current thread's own signal above; it's pattern-level context about the company, not about this specific round:
${JSON.stringify(crossOpportunityDigest, null, 2)}`
    : ""
}

Produce:
1. "interviewerContext": who this person is and what that implies for the conversation, grounded in their captured profile — or a plain statement that no profile is linked and this section is generic.
2. "likelyFocusAreas": 3-6 themes this interviewer/stage will likely probe, each with "why" tied to the interviewer's background, the stage type, or prior-round signal.
3. "anticipatedQuestions": 3-6 specific questions likely to come up, each with "prepGuidance" tied to the candidate's actual experience — not generic interview advice.
4. "storiesToPrepare": 2-4 STAR-style prompts ("a time you...") with "candidateAngle" naming which real experience from the candidate's background to draw on.
5. "questionsToAskThem": 2-4 questions the candidate should ask, specific to this interviewer/stage/role, not generic "what's the culture like" filler.
6. "continuityNotes": what's changed or should be addressed relative to prior rounds in this thread — null only when there are no prior rounds.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Interview guide did not parse");
  }

  await recordApiCall({
    activity: "generateInterviewGuide",
    model: CLAUDE_MODEL,
    usage: response.usage,
    companyId: opportunity.companyId,
    jobPostingId: opportunity.jobPostingId ?? undefined,
    isRerun: round.guideJson != null,
  });

  return prisma.interviewRound.update({
    where: { id: roundId },
    data: { guideJson: JSON.stringify(response.parsed_output), guideGeneratedAt: new Date() },
  });
}
