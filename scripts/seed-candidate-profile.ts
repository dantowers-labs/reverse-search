// One-time bootstrap: parse an already-assembled candidate profile doc (plain
// text/markdown — your resume, a LinkedIn export, whatever you have) into
// CandidateProfile via the same LLM-extraction approach the rest of the app
// uses, so the schema stays consistent. Re-running overwrites the profile —
// use the /candidate-profile ingestion pipeline for incremental updates after
// this. Usage: npx tsx scripts/seed-candidate-profile.ts /path/to/your/profile.md
import { readFileSync } from "fs";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, CLAUDE_MODEL } from "../src/lib/anthropic";
import { CandidateProfileDataSchema } from "../src/lib/schemas";
import { prisma } from "../src/lib/prisma";

const SOURCE_PATH = process.argv[2];
if (!SOURCE_PATH) {
  console.error("Usage: npx tsx scripts/seed-candidate-profile.ts /path/to/your/profile.md");
  process.exit(1);
}

async function main() {
  const raw = readFileSync(SOURCE_PATH, "utf-8");

  const response = await anthropic.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    output_config: { format: zodOutputFormat(CandidateProfileDataSchema), effort: "medium" },
    messages: [
      {
        role: "user",
        content: `Extract this candidate profile document into the structured schema. Preserve identity (name, LinkedIn headline, location), languages with levels, education, full professional experience (title, company, dates, location, a concise description per role), technical skills split into primary/secondary/domain/software tiers as the document organizes them, and target criteria (target sectors, deal-breakers, comp floor, relocation stance).\n\n${raw}`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Extraction failed to parse against the schema");
  }

  const data = response.parsed_output;

  const existing = await prisma.candidateProfile.findFirst();
  if (existing) {
    await prisma.candidateProfile.update({
      where: { id: existing.id },
      data: {
        name: data.identity.name,
        headline: data.identity.headline,
        dataJson: JSON.stringify(data),
      },
    });
  } else {
    await prisma.candidateProfile.create({
      data: {
        name: data.identity.name,
        headline: data.identity.headline,
        dataJson: JSON.stringify(data),
      },
    });
  }

  await prisma.candidateDocument.create({
    data: {
      fileType: "cv",
      fileName: SOURCE_PATH.split("/").pop() ?? SOURCE_PATH,
      filePath: SOURCE_PATH,
      extractedJson: JSON.stringify(data),
    },
  });

  console.log(`Seeded candidate profile for ${data.identity.name}.`);
  console.log(`Experience entries: ${data.experience.length}, skills (primary): ${data.skills.primary.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
