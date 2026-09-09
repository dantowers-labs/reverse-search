import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, CLAUDE_FAST_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { MergedPersonSchema, ScreenshotExtractionSchema, type ScreenshotExtraction } from "@/lib/schemas";
import { recordApiCall } from "@/lib/usageTracking";
import { normalizePersonName } from "@/lib/personDisplay";
import { parseApproximateDate } from "@/lib/approximateDate";

const IMAGE_MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

const EXTRACTION_INSTRUCTION =
  "This is a screenshot or a LinkedIn-exported PDF of one person's LinkedIn profile. Extract: the person's full name if it's visible in this capture, their current job title, their LinkedIn headline, their About/summary section text (verbatim if visible), a flat list of skills shown, a few short experience bullet points if visible, a one or two word seniority guess (e.g. 'IC', 'manager', 'director', 'VP', 'C-level'), companyTenureStartDate: the EARLIEST date shown under their current employer's experience entry — if LinkedIn shows several titles grouped under one company header (internal promotions), use the start of the earliest one, not the most recent title change. Format as 'YYYY-MM' if a month is shown, 'YYYY' if only a year is shown. And connectionDegree: LinkedIn's own degree badge shown near the person's name at the top of their profile page — exactly '1st', '2nd', or '3rd', those are the only three that appear there. Someone beyond 3rd-degree (out of network) shows NO badge at all, not a '3rd+' label — treat that absence the same as any other not-visible field: null. And priorEmployers: the company name from every OTHER experience entry visible in this capture — not their current employer at the company being researched, everywhere else they've worked. Short company names as LinkedIn shows them, e.g. ['Kestrel Data', 'Orrery Group']. Empty array if no other experience entries are visible. Use null for any field not visible in this capture — never guess or infer a name from other context, only extract one that's actually shown on the page, and don't guess a date, degree, or employer name if not visible.";

async function extractOneFile(fileName: string, buffer: Buffer, companyId: number): Promise<ScreenshotExtraction> {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const isPdf = ext === "pdf";
  const imageMediaType = IMAGE_MEDIA_TYPES[ext];
  if (!isPdf && !imageMediaType) {
    throw new Error(`Unsupported file type ".${ext}" — use an image or a PDF profile export`);
  }

  const response = await anthropic.messages.parse({
    model: CLAUDE_FAST_MODEL,
    max_tokens: 4000,
    // Haiku 4.5 doesn't accept output_config.effort — that knob is Opus/Sonnet-only.
    output_config: { format: zodOutputFormat(ScreenshotExtractionSchema) },
    messages: [
      {
        role: "user",
        content: [
          isPdf
            ? {
                type: "document" as const,
                source: { type: "base64" as const, media_type: "application/pdf" as const, data: buffer.toString("base64") },
              }
            : {
                type: "image" as const,
                source: { type: "base64" as const, media_type: imageMediaType as "image/png", data: buffer.toString("base64") },
              },
          { type: "text" as const, text: EXTRACTION_INSTRUCTION },
        ],
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Extraction did not parse");
  }
  await recordApiCall({ activity: "extractPerson", model: CLAUDE_FAST_MODEL, usage: response.usage, companyId });
  return response.parsed_output;
}

// One "Add person" action: 1+ screenshots of the same LinkedIn profile.
export async function extractAndCreatePerson(
  companyId: number,
  files: { name: string; buffer: Buffer }[],
) {
  if (files.length === 0) throw new Error("No files provided");

  const person = await prisma.personProfile.create({ data: { companyId } });

  const extractions: ScreenshotExtraction[] = [];
  for (const file of files) {
    const extraction = await extractOneFile(file.name, file.buffer, companyId);
    extractions.push(extraction);

    const savedPath = saveUploadedFile(`companies/${companyId}/people/${person.id}`, file.name, file.buffer);
    await prisma.screenshotImage.create({
      data: {
        personProfileId: person.id,
        imagePath: savedPath,
        rawExtractionJson: JSON.stringify(extraction),
      },
    });
  }

  const merged =
    extractions.length === 1
      ? {
          name: extractions[0].name,
          title: extractions[0].title,
          headline: extractions[0].headline,
          about: extractions[0].aboutText,
          skills: extractions[0].skills,
          companyTenureStartDate: extractions[0].companyTenureStartDate,
          connectionDegree: extractions[0].connectionDegree,
          priorEmployers: extractions[0].priorEmployers,
        }
      : await (async () => {
          const response = await anthropic.messages.parse({
            model: CLAUDE_FAST_MODEL,
            max_tokens: 4000,
            output_config: { format: zodOutputFormat(MergedPersonSchema) },
            messages: [
              {
                role: "user",
                content: `These are extraction results from ${extractions.length} screenshots of the SAME LinkedIn profile (e.g. one screenshot per section, or a scroll that split the About text). Reconcile them into one consistent record: prefer the most complete name/title/headline (they should agree — if two fragments show conflicting names, prefer the more complete/formal-looking one), union the skill lists (dedup), stitch About-text fragments together in a sensible reading order if they look like they're parts of the same paragraph, for companyTenureStartDate take whichever non-null value appears (they should agree since it's the same profile; if they conflict, prefer the earlier date since it should reflect the start of their earliest title at this company), for connectionDegree take whichever non-null value appears (they should agree since it's the same profile), and union the priorEmployers lists (dedup).\n\n${JSON.stringify(extractions, null, 2)}`,
              },
            ],
          });
          if (!response.parsed_output) throw new Error("Person merge did not parse");
          await recordApiCall({ activity: "mergePerson", model: CLAUDE_FAST_MODEL, usage: response.usage, companyId });
          return response.parsed_output;
        })();

  if (merged.name) {
    const existing = await findExistingPersonByName(companyId, merged.name, person.id);
    if (existing) {
      // Roll back the placeholder row created above — extraction already ran
      // (that cost is sunk either way, since it's how we learn who this is),
      // but there's no reason to leave a duplicate PersonProfile behind.
      await prisma.personProfile.delete({ where: { id: person.id } });
      throw new Error(
        `"${merged.name}" is already captured for this company (see the existing profile) — skipped to avoid a duplicate.`,
      );
    }
  }

  await prisma.personProfile.update({
    where: { id: person.id },
    data: {
      mergedName: merged.name,
      mergedTitle: merged.title,
      mergedHeadline: merged.headline,
      mergedAbout: merged.about,
      mergedSkillsJson: JSON.stringify(merged.skills),
      companyTenureStartDate: parseApproximateDate(merged.companyTenureStartDate),
      connectionDegree: merged.connectionDegree,
      priorEmployersJson: JSON.stringify(merged.priorEmployers),
    },
  });

  return person.id;
}

async function findExistingPersonByName(companyId: number, name: string, excludePersonId: number) {
  const target = normalizePersonName(name);
  const candidates = await prisma.personProfile.findMany({
    where: { companyId, id: { not: excludePersonId }, mergedName: { not: null } },
    select: { id: true, mergedName: true },
  });
  return candidates.find((c) => c.mergedName && normalizePersonName(c.mergedName) === target) ?? null;
}

// Bulk mode: each file is a SEPARATE, already-complete person capture (e.g. a
// batch of LinkedIn "Save to PDF" exports, one per person) — no merging across
// files. Use extractAndCreatePerson instead when multiple files are fragments
// of the same profile (e.g. a scroll split across several screenshots).
//
// Runs extraction with bounded concurrency: a batch of 15 sequential Claude
// calls takes minutes with a frozen "uploading" UI and no feedback — running
// several at once cuts that to under a minute and shortens the window in
// which a dropped connection would leave the batch half-done.
const BULK_CONCURRENCY = 5;

export async function extractAndCreatePeopleBulk(
  companyId: number,
  files: { name: string; buffer: Buffer }[],
) {
  if (files.length === 0) throw new Error("No files provided");

  const personIds: number[] = [];
  const errors: { name: string; error: string }[] = [];
  const duplicates: { name: string; existingPersonId: number }[] = [];

  const existingPeople = await prisma.personProfile.findMany({
    where: { companyId, mergedName: { not: null } },
    select: { id: true, mergedName: true },
  });
  // Seeded from the DB, then grown as this batch resolves — catches both
  // re-uploads of an already-captured person AND accidental duplicate files
  // within the same bulk batch (best-effort under concurrency: two files for
  // the same new person landing at the exact same instant can still both slip
  // through, but that's a rare edge case worth accepting for the common case).
  const seenNames = new Map<string, number>(
    existingPeople.map((p) => [normalizePersonName(p.mergedName as string), p.id]),
  );

  async function processOne(file: { name: string; buffer: Buffer }) {
    try {
      const extraction = await extractOneFile(file.name, file.buffer, companyId);
      if (extraction.name) {
        const key = normalizePersonName(extraction.name);
        const existingId = seenNames.get(key);
        if (existingId != null) {
          duplicates.push({ name: extraction.name, existingPersonId: existingId });
          return;
        }
      }
      const person = await prisma.personProfile.create({
        data: {
          companyId,
          mergedName: extraction.name,
          mergedTitle: extraction.title,
          mergedHeadline: extraction.headline,
          mergedAbout: extraction.aboutText,
          mergedSkillsJson: JSON.stringify(extraction.skills),
          companyTenureStartDate: parseApproximateDate(extraction.companyTenureStartDate),
          connectionDegree: extraction.connectionDegree,
          priorEmployersJson: JSON.stringify(extraction.priorEmployers),
        },
      });
      if (extraction.name) seenNames.set(normalizePersonName(extraction.name), person.id);
      const savedPath = saveUploadedFile(`companies/${companyId}/people/${person.id}`, file.name, file.buffer);
      await prisma.screenshotImage.create({
        data: {
          personProfileId: person.id,
          imagePath: savedPath,
          rawExtractionJson: JSON.stringify(extraction),
        },
      });
      personIds.push(person.id);
    } catch (err) {
      errors.push({ name: file.name, error: err instanceof Error ? err.message : "Extraction failed" });
    }
  }

  const queue = [...files];
  async function worker() {
    let next: { name: string; buffer: Buffer } | undefined;
    while ((next = queue.shift())) {
      await processOne(next);
    }
  }
  await Promise.all(Array.from({ length: Math.min(BULK_CONCURRENCY, files.length) }, worker));

  return { personIds, errors, duplicates };
}
