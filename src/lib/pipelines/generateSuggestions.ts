import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { SuggestionResultSchema } from "@/lib/schemas";
import { recordApiCall } from "@/lib/usageTracking";
import { findConnectionsAtCompany } from "@/lib/connectionMatching";

export async function generateSuggestions() {
  const companiesWithRuns = await prisma.company.findMany({
    include: { analysisRuns: { orderBy: { createdAt: "desc" }, take: 1, include: { clusters: true } } },
  });
  const analyzed = companiesWithRuns.filter((c) => c.analysisRuns.length > 0);

  if (analyzed.length < 2) {
    return { suggestions: [], skipped: "need at least 2 analyzed companies to detect a pattern" };
  }

  const fitSignature = analyzed.map((c) => {
    const run = c.analysisRuns[0];
    return {
      company: c.name,
      overallVerdict: run.overallVerdict,
      overallScore: run.overallScore,
      overallSummary: run.overallSummary,
      clusters: run.clusters.map((cl) => ({
        label: cl.clusterLabel,
        summary: cl.aggregateSummary,
        fitVerdict: cl.fitVerdict,
      })),
    };
  });

  const existingNames = new Set(companiesWithRuns.map((c) => c.name.toLowerCase()));
  const dismissed = await prisma.suggestion.findMany({
    where: { status: "dismissed" },
    select: { trackerCompanyId: true, feedbackNote: true, trackerCompany: { select: { name: true } } },
  });
  const dismissedIds = new Set(dismissed.map((d) => d.trackerCompanyId));
  // The candidate's own reasoning for passing on a prior suggestion — cheap
  // secondary context (just more prompt text), not a general pattern-learning
  // system. Only companies where they actually left a note are worth including.
  const dismissedWithFeedback = dismissed
    .filter((d) => d.feedbackNote)
    .map((d) => ({ company: d.trackerCompany.name, note: d.feedbackNote }));

  const trackerCompanies = await prisma.trackerCompany.findMany();
  const candidatePool = trackerCompanies.filter(
    (t) => !existingNames.has(t.name.toLowerCase()) && !dismissedIds.has(t.id),
  );

  if (candidatePool.length === 0) {
    return { suggestions: [], skipped: "no un-promoted tracker companies left to evaluate" };
  }

  const candidatePoolWithConnections = await Promise.all(
    candidatePool.map(async (t) => {
      const connections = await findConnectionsAtCompany(t.name);
      return {
        name: t.name,
        sector: t.sector,
        role: t.role,
        status: t.status,
        notes: t.notes,
        knownConnections: connections.length > 0 ? connections : undefined,
      };
    }),
  );

  const response = await anthropic.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 12000,
    output_config: { format: zodOutputFormat(SuggestionResultSchema), effort: "high" },
    messages: [
      {
        role: "user",
        content: `A job candidate has manually researched and analyzed a "birds of a feather" fit pattern for a few companies (below), by comparing LinkedIn profiles of people who work there against their own background. They also have a larger pool of other companies from their job-search tracker that they haven't researched yet.

Task: flag tracker companies worth adding as a research project because they structurally resemble a confirmed-fit or confirmed-mismatch pattern from the analyzed companies, OR because the candidate already has a direct 1st-degree connection there — the goal is to surface companies the candidate might be overlooking, not to guess at company culture from name alone. Use whatever signal the tracker gives you (sector, role applied to, application status, notes) plus your own knowledge of these companies where you're confident about it; say explicitly when you're inferring from general knowledge of a company vs. from the tracker data itself.

A candidate pool entry may carry "knownConnections" — people from the candidate's own LinkedIn network who list that company (loosely matched on company name, so treat it as a strong lead worth naming, not a guaranteed match). When present, this is a genuinely strong signal on its own — a real person to talk to outranks a sector-adjacency guess — and "basedOnPattern" should name them directly (e.g. "Direct connection — Jane Doe, VP Solutions Consulting") rather than folding it into generic reasoning.

Only suggest companies actually present in the candidate pool below — never invent one. Return at most 8 suggestions — the strongest matches only, ranked by how confident you are, not everything plausible.

Each suggestion also needs a "verdict": ONE STANDALONE SENTENCE, max ~110 characters, written to stand alone with nothing else around it (this is what renders on the collapsed suggestion row) — the specific reason this company is worth a look, blunt, never hedges, distinct from the fuller "reasoning" paragraph.

Fit patterns already established (from real analyzed companies):
${JSON.stringify(fitSignature, null, 2)}

${
  dismissedWithFeedback.length > 0
    ? `Previously flagged and passed on, with the candidate's own reasoning — don't re-flag these, and use them to calibrate how much weight pattern-match strength should carry vs. actual candidate priority for structurally similar cases:
${JSON.stringify(dismissedWithFeedback, null, 2)}`
    : ""
}

Candidate pool (tracker companies not yet researched):
${JSON.stringify(candidatePoolWithConnections, null, 2)}`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Suggestion generation did not parse");
  }

  await recordApiCall({ activity: "generateSuggestions", model: CLAUDE_MODEL, usage: response.usage });

  const byName = new Map(candidatePool.map((t) => [t.name.toLowerCase(), t]));
  const created = [];
  for (const s of response.parsed_output.suggestions) {
    const tracker = byName.get(s.companyName.toLowerCase());
    if (!tracker) continue; // ignore anything not actually in the pool

    const existingSuggestion = await prisma.suggestion.findFirst({
      where: { trackerCompanyId: tracker.id, status: "new" },
    });

    if (existingSuggestion) {
      await prisma.suggestion.update({
        where: { id: existingSuggestion.id },
        data: { reasoning: s.reasoning, verdict: s.verdict, basedOnPattern: s.basedOnPattern, confidenceScore: s.confidenceScore },
      });
      created.push(existingSuggestion.id);
    } else {
      const row = await prisma.suggestion.create({
        data: {
          trackerCompanyId: tracker.id,
          reasoning: s.reasoning,
          verdict: s.verdict,
          basedOnPattern: s.basedOnPattern,
          confidenceScore: s.confidenceScore,
        },
      });
      created.push(row.id);
    }
  }

  return { suggestions: created };
}
