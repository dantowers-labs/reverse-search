import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { extractDocText } from "@/lib/extractDocText";
import { saveUploadedFile } from "@/lib/storage";
import {
  CandidateDocExtractionSchema,
  ProfileChangeSetSchema,
  type CandidateProfileData,
} from "@/lib/schemas";
import { recordApiCall } from "@/lib/usageTracking";

// Mirrors AI-Job-Search's /setup Path A: parse a source document, cross-reference
// against the current profile, and return additive/conflicting changes for review
// before anything is written. See POST /api/candidate-profile/apply-changes.
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const fileType = String(form.get("fileType") ?? "other");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const savedPath = saveUploadedFile("candidate-documents", file.name, buffer);
  const isPdf = file.name.toLowerCase().endsWith(".pdf");

  const instruction = `Extract candidate profile information from this ${fileType} document: identity (location), languages with proficiency levels, education, work experience (title, company, dates, location, description), a flat list of skills, and a one-paragraph summary if present.`;

  const extraction = await anthropic.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    output_config: { format: zodOutputFormat(CandidateDocExtractionSchema), effort: "medium" },
    messages: [
      {
        role: "user",
        content: isPdf
          ? [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
              },
              { type: "text", text: instruction },
            ]
          : `${instruction}\n\n${await extractDocText(file.name, buffer)}`,
      },
    ],
  });

  if (!extraction.parsed_output) {
    return NextResponse.json({ error: "Extraction did not parse" }, { status: 422 });
  }

  await recordApiCall({ activity: "candidateProfileExtract", model: CLAUDE_MODEL, usage: extraction.usage });

  const profile = await prisma.candidateProfile.findFirst();
  const currentData: CandidateProfileData | null = profile
    ? JSON.parse(profile.dataJson)
    : null;

  const changeSetResponse = await anthropic.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    output_config: { format: zodOutputFormat(ProfileChangeSetSchema), effort: "medium" },
    messages: [
      {
        role: "user",
        content: `Compare the newly-extracted document data against the candidate's current profile and produce a change set.

Additive changes: information present in the new document but not in the current profile in any form (a new job, a new skill, a new certification-like detail).
Conflicting changes: information that touches something already in the profile but disagrees (a different date range, a different title for the same role, a different degree date).

For each change, "field" should be a short dotted path or label (e.g. "experience[].title", "languages"), "value"/"proposed" a short human-readable string of the new value, and "description" one sentence of context.

Current profile (JSON, null if none exists yet):
${currentData ? JSON.stringify(currentData, null, 2) : "null"}

Newly extracted document data (JSON):
${JSON.stringify(extraction.parsed_output, null, 2)}`,
      },
    ],
  });

  if (!changeSetResponse.parsed_output) {
    return NextResponse.json({ error: "Change-set comparison did not parse" }, { status: 422 });
  }

  await recordApiCall({ activity: "candidateProfileChangeset", model: CLAUDE_MODEL, usage: changeSetResponse.usage });

  return NextResponse.json({
    savedPath,
    fileType,
    fileName: file.name,
    extraction: extraction.parsed_output,
    changeSet: changeSetResponse.parsed_output,
  });
}
