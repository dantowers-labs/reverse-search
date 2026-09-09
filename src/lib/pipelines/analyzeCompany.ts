import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { AnalysisResultSchema } from "@/lib/schemas";
import type { CandidateProfileData } from "@/lib/schemas";
import { recordApiCall } from "@/lib/usageTracking";

export async function analyzeCompany(companyId: number) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const people = await prisma.personProfile.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });

  if (people.length === 0) {
    throw new Error("No people captured for this company yet");
  }

  const candidateProfile = await prisma.candidateProfile.findFirst();
  if (!candidateProfile) {
    throw new Error("No candidate profile set up yet — add a resume or LinkedIn export at /candidate-profile");
  }
  const candidateData: CandidateProfileData = JSON.parse(candidateProfile.dataJson);

  const peopleForPrompt = people.map((p, index) => ({
    index,
    title: p.mergedTitle,
    headline: p.mergedHeadline,
    about: p.mergedAbout,
    skills: p.mergedSkillsJson ? JSON.parse(p.mergedSkillsJson) : [],
  }));

  // Kept separate from peopleForPrompt above rather than folded into it —
  // connection degree has nothing to do with role/skill clustering, it only
  // matters for confidenceNote's honest read on sample composition.
  const degreeCounts = new Map<string, number>();
  for (const p of people) {
    if (p.connectionDegree) degreeCounts.set(p.connectionDegree, (degreeCounts.get(p.connectionDegree) ?? 0) + 1);
  }
  const knownDegreeCount = Array.from(degreeCounts.values()).reduce((a, b) => a + b, 0);
  const firstDegreeCount = degreeCounts.get("1st") ?? 0;
  const degreeMixNote =
    knownDegreeCount >= 3
      ? `Of the captured people with a known LinkedIn connection degree, ${firstDegreeCount} of ${knownDegreeCount} are 1st-degree (the candidate's own direct network) — full breakdown: ${JSON.stringify(Object.fromEntries(degreeCounts))}.`
      : null;

  const interviewRounds = await prisma.interviewRound.findMany({
    where: { interview: { companyId } },
    orderBy: { sequence: "asc" },
  });

  const response = await anthropic.messages.parse({
    model: CLAUDE_MODEL,
    // Raised from 8000: splitting each cluster's fitReasoning into separate
    // alignmentReasoning/divergenceReasoning fields roughly doubled the
    // per-cluster output volume, and a company with several clusters (e.g.
    // Akkio, 7 clusters/22 people) could hit the old ceiling mid-response,
    // truncating the JSON output.
    max_tokens: 16000,
    output_config: { format: zodOutputFormat(AnalysisResultSchema), effort: "high" },
    messages: [
      {
        role: "user",
        content: `You are helping a job candidate assess whether ${company.name} hires people with a profile similar to their own ("birds of a feather") — a signal for whether they'd be a good culture/skill fit, independent of whether a specific role is open.

Candidate profile (the reference point):
${JSON.stringify(candidateData, null, 2)}

${company.researchNotes ? `The candidate's own history/context with ${company.name}, in their own words — weigh this as real signal (it may explain past outcomes, current priority, or suggest a different approach than a cold one):\n${company.researchNotes}\n` : ""}
People captured at ${company.name} (each is one real LinkedIn profile the candidate manually screenshotted — titles, headlines, About text, and skills as extracted):
${JSON.stringify(peopleForPrompt, null, 2)}
${degreeMixNote ? `\n${degreeMixNote} This is about the sample's own composition, not any one person's fit — only relevant to instruction 4 below.\n` : ""}

None of the text fields below should ever reference internal bookkeeping — an index number, a
list position, "person #N", "Index 0", or similar. Every field is prose a reader will see with
zero other context; write each as a finished sentence, never a fragment of your own reasoning
about which person in the list prompted it.

Task:
1. Cluster these people into role groups based on what they actually do (their title/headline/skills), not a fixed taxonomy — an Accountant and a VP of Marketing must land in separate clusters, for example. Reuse a cluster only when people are doing genuinely similar work.
2. For each cluster, write a short aggregate summary of the common language, skills, and themes in their self-descriptions, and score (0-100) how well that cluster's profile overlaps with the candidate's own skills/background/language — "fitScore" — with a "fitVerdict". "fitVerdict" is ONE STANDALONE SENTENCE, max ~110 characters, written to stand alone with nothing else around it — not a summary, not the first sentence of either reasoning field below, not a label. It must name the specific overlap or mismatch concretely enough that it couldn't apply to a different cluster (e.g. "Your literal center: adtech SE work, POC-led selling, AI translated into business outcomes." or "You are technical enough to hold your own, but you have never run an engineering org."). Blunt, specific, never hedges.
   Then write the pro/con case as two SEPARATE fields, not one blended paragraph — a reader deciding whether to pursue this should be able to weigh each on its own:
   - "alignmentReasoning": the concrete case FOR this cluster, grounded in specifics from both sides (shared frameworks, scale, role scope, background) — not generic praise.
   - "divergenceReasoning": the concrete case AGAINST — the real, specific way this cluster's actual hiring pattern differs from the candidate (company stage/size, team-scaling scope, domain, whatever is genuinely different), stated as bluntly as a rejection reason would be, not softened into a caveat. Set this to null ONLY when there truly isn't a real divergence to name — a strong, clean match with no honest gap. Don't manufacture one just to fill the field, but don't bury a real one in alignmentReasoning either — if there's a genuine "this is probably why you wouldn't get this" angle, it belongs here, separated out, not folded into the positive case.
3. Roll up an "overallVerdict" (the SAME one-sentence, ~110-character, stand-alone standard as fitVerdict above — this is rendered on its own as the dashboard's headline finding, with nothing else around it), an "overallScore", and an "overallSummary" describing whether this company's hiring pattern (based on who was captured) resembles the candidate or not, and why.
4. Write "confidenceNote": one or two honest sentences on whether this sample is big enough to trust. Call out real gaps — a lopsided sample (all one role), too few people overall, or missing role types you'd expect to be informative (e.g. no one in the function the candidate would actually be hired into) — and name what to go capture next if the sample is thin. Don't hedge on a sample that's actually fine just to seem cautious. Also name the sample's own limit as a signal of intent: captured people show who applied and accepted, not necessarily who the company wanted most — that gap is real and worth naming explicitly at a small company or a thin sample (a handful of people isn't "the company's type," it's who was available and said yes), but don't manufacture the caveat where the sample is large enough that this stops being the dominant uncertainty. Separately, if the degree-mix note above is present, name it as its OWN distinct caveat when it's heavily 1st-degree-skewed — a sample that's mostly the candidate's own existing network isn't reading the company's hiring pattern, it's reading the candidate's own contact list, and that's a different problem from sample size (fixing it means going further into the network, not just capturing more people close by). Don't conflate the two into one vague hedge — say which specific limit applies, if any.
5. Write "openingMessage": 2-4 sentences, written directly to the candidate as the opening line of a conversation (not a report recap) — lead with the single most useful takeaway from this analysis, in plain language, the way a sharp colleague would open if you asked "so, worth pursuing?"
6. Write "suggestedQuestions": grouped under 3-4 topic headings (dynamic, not a fixed taxonomy — name each "topic" for what it actually is, e.g. "the seniority question", "where the analysis is thin"${interviewRounds.length > 0 ? `, "preparing for ${interviewRounds[interviewRounds.length - 1].interviewerName}"` : ""}, "reading ${company.name} as a company"), 2-3 questions per topic, every question grounded in what's actually in this analysis (reference real cluster names/people patterns, not generic prompts like "tell me more"). A flat list of ~10 questions is noise — the grouping is what makes that many readable, so don't skip straight to generic topics just to fill the count.${
      interviewRounds.length > 0
        ? `\n\nThe candidate has real interview rounds in progress here — use these to ground a "preparing for <name>" topic when it's genuinely useful, not as filler: ${JSON.stringify(interviewRounds.map((r) => ({ stage: r.stage, interviewer: r.interviewerName, notes: r.notes })), null, 2)}`
        : ""
    }

memberIndices in each cluster must reference the "index" field of the people list above.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Analysis did not parse");
  }

  const result = response.parsed_output;

  const priorRunCount = await prisma.analysisRun.count({ where: { companyId } });
  await recordApiCall({
    activity: "analyzeCompany",
    model: CLAUDE_MODEL,
    usage: response.usage,
    companyId,
    isRerun: priorRunCount > 0,
  });

  const run = await prisma.analysisRun.create({
    data: {
      companyId,
      personCountAtRun: people.length,
      overallVerdict: result.overallVerdict,
      overallScore: result.overallScore,
      overallSummary: result.overallSummary,
      confidenceNote: result.confidenceNote,
      suggestedQuestionsJson: JSON.stringify(result.suggestedQuestions),
      clusters: {
        create: result.clusters.map((c) => ({
          clusterLabel: c.label,
          memberPersonProfileIdsJson: JSON.stringify(
            c.memberIndices.map((i) => people[i]?.id).filter((id): id is number => id != null),
          ),
          aggregateSummary: c.aggregateSummary,
          fitScore: c.fitScore,
          fitVerdict: c.fitVerdict,
          alignmentReasoning: c.alignmentReasoning,
          divergenceReasoning: c.divergenceReasoning,
        })),
      },
    },
    include: { clusters: true },
  });

  // Seed the chat with an opening take so it isn't a blank box — only on the
  // first analysis for this company, so re-analyzing mid-conversation doesn't
  // interrupt an ongoing chat with a repeated intro.
  const existingChatCount = await prisma.chatMessage.count({ where: { companyId } });
  if (existingChatCount === 0) {
    await prisma.chatMessage.create({
      data: { companyId, role: "assistant", content: result.openingMessage },
    });
  }

  return run;
}
