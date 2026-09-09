import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import type { CandidateProfileData } from "@/lib/schemas";
import { recordApiCall } from "@/lib/usageTracking";

export async function POST(request: Request, ctx: RouteContext<"/api/companies/[id]/chat">) {
  const { id } = await ctx.params;
  const companyId = Number(id);
  const { message } = (await request.json()) as { message: string };

  const [company, candidateProfile, latestRun, people, history] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    prisma.candidateProfile.findFirst(),
    prisma.analysisRun.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: { clusters: true },
    }),
    prisma.personProfile.findMany({ where: { companyId } }),
    prisma.chatMessage.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
  ]);

  const candidateData: CandidateProfileData | null = candidateProfile
    ? JSON.parse(candidateProfile.dataJson)
    : null;

  const systemPrompt = `You are helping a job candidate think through whether ${company.name} is a good "birds of a feather" fit for them, based on LinkedIn profiles they've manually collected of people who work there. Answer grounded only in the data below — if something isn't in the analysis or the captured profiles, say so rather than speculating.

Candidate profile:
${candidateData ? JSON.stringify(candidateData, null, 2) : "(not set up yet)"}

Latest analysis run for ${company.name}${latestRun ? "" : ": none run yet — tell the user to click Analyze first if they ask about fit"}:
${latestRun ? JSON.stringify({ overallVerdict: latestRun.overallVerdict, overallScore: latestRun.overallScore, overallSummary: latestRun.overallSummary, clusters: latestRun.clusters.map((c) => ({ label: c.clusterLabel, summary: c.aggregateSummary, fitScore: c.fitScore, fitVerdict: c.fitVerdict, alignmentReasoning: c.alignmentReasoning ?? c.fitReasoning, divergenceReasoning: c.divergenceReasoning })) }, null, 2) : ""}

People captured at ${company.name} (titles/headlines only):
${JSON.stringify(people.map((p) => ({ title: p.mergedTitle, headline: p.mergedHeadline })), null, 2)}`;

  await prisma.chatMessage.create({ data: { companyId, role: "user", content: message } });

  const anthropicMessages = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  const stream = anthropic.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    // Grounded Q&A over data already in the prompt doesn't need deep reasoning —
    // low effort cuts cost/latency per turn without dropping to a weaker model.
    output_config: { effort: "low" },
    system: systemPrompt,
    messages: anthropicMessages,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
      try {
        const final = await stream.finalMessage();
        let text = "";
        for (const block of final.content) {
          if (block.type === "text") text += block.text;
        }
        await prisma.chatMessage.create({ data: { companyId, role: "assistant", content: text } });
        await recordApiCall({ activity: "chat", model: CLAUDE_MODEL, usage: final.usage, companyId });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(_request: Request, ctx: RouteContext<"/api/companies/[id]/chat">) {
  const { id } = await ctx.params;
  const companyId = Number(id);
  const messages = await prisma.chatMessage.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({ messages });
}
