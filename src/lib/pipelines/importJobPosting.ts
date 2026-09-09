import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { JobPostingExtractionSchema } from "@/lib/schemas";
import { recordApiCall } from "@/lib/usageTracking";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Imports a pasted job description: extracts structure, resolves it to a
// Company (an explicit companyId wins — e.g. importing from a company page —
// otherwise the company is inferred from the posting text itself, using the
// actual hiring brand rather than a holding company, and created if new).
export async function importJobPosting(
  rawText: string,
  applicationStatus: string | null,
  companyIdOverride?: number,
) {
  const response = await anthropic.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    output_config: { format: zodOutputFormat(JobPostingExtractionSchema), effort: "medium" },
    messages: [
      {
        role: "user",
        content: `Extract this job posting into structured fields. "companyName" should be the actual hiring/operating brand — e.g. a posting that says "Brand: Merkle" under a Dentsu-network footer is a Merkle posting, not a Dentsu one. "functionType" should name the actual kind of work in plain terms (e.g. "Presales / Solutions Consulting", "Advisory / Delivery Consulting", "Technical Architecture", "Account/Program Management") — this is used later to compare against how the candidate's own resume is currently framed, so be precise rather than generic.\n\n${rawText}`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Job posting extraction did not parse");
  }
  const extraction = response.parsed_output;

  const companyId = companyIdOverride
    ? (await prisma.company.findUniqueOrThrow({ where: { id: companyIdOverride } })).id
    : (
        await prisma.company.upsert({
          where: { slug: slugify(extraction.companyName) },
          update: {},
          create: { name: extraction.companyName, slug: slugify(extraction.companyName) },
        })
      ).id;

  await recordApiCall({
    activity: "importJobPosting",
    model: CLAUDE_MODEL,
    usage: response.usage,
    companyId,
  });

  const jobPosting = await prisma.jobPosting.create({
    data: {
      companyId,
      title: extraction.title,
      rawText,
      seniority: extraction.seniority,
      functionType: extraction.functionType,
      keyResponsibilitiesJson: JSON.stringify(extraction.keyResponsibilities),
      requiredExperienceJson: JSON.stringify(extraction.requiredExperience),
      compensationRange: extraction.compensationRange,
      applicationStatus,
    },
  });

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  return { jobPosting, companySlug: company.slug };
}
