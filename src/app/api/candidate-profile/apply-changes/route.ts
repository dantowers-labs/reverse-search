import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import {
  CandidateProfileDataSchema,
  type CandidateDocExtraction,
  type CandidateProfileData,
  type ProfileChangeSet,
} from "@/lib/schemas";
import { recordApiCall } from "@/lib/usageTracking";

interface ApplyChangesBody {
  savedPath: string;
  fileType: string;
  fileName: string;
  extraction: CandidateDocExtraction;
  confirmedAdditive: ProfileChangeSet["additive"];
  confirmedConflicting: ProfileChangeSet["conflicting"];
}

// Commits only the confirmed subset of a change set proposed by /ingest.
export async function POST(request: Request) {
  const body = (await request.json()) as ApplyChangesBody;

  if (body.confirmedAdditive.length === 0 && body.confirmedConflicting.length === 0) {
    return NextResponse.json({ error: "Nothing confirmed to apply" }, { status: 400 });
  }

  const existing = await prisma.candidateProfile.findFirst();
  const currentData: CandidateProfileData | null = existing
    ? JSON.parse(existing.dataJson)
    : null;

  const merged = await anthropic.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    output_config: { format: zodOutputFormat(CandidateProfileDataSchema), effort: "medium" },
    messages: [
      {
        role: "user",
        content: `Produce the updated full candidate profile by merging ONLY the confirmed changes below into the current profile. Preserve every existing field not touched by a confirmed change. Do not apply anything from the source extraction that isn't listed as confirmed.

Current profile (null if none exists — build the profile fresh from the extraction plus confirmed changes in that case):
${currentData ? JSON.stringify(currentData, null, 2) : "null"}

Full source extraction (context only — apply only the confirmed subset below):
${JSON.stringify(body.extraction, null, 2)}

Confirmed additive changes:
${JSON.stringify(body.confirmedAdditive, null, 2)}

Confirmed conflicting changes (each should overwrite the current value with the proposed one):
${JSON.stringify(body.confirmedConflicting, null, 2)}`,
      },
    ],
  });

  if (!merged.parsed_output) {
    return NextResponse.json({ error: "Merge did not parse" }, { status: 422 });
  }

  await recordApiCall({ activity: "candidateProfileApply", model: CLAUDE_MODEL, usage: merged.usage });

  const data = merged.parsed_output;

  const record = existing
    ? await prisma.candidateProfile.update({
        where: { id: existing.id },
        data: {
          name: data.identity.name,
          headline: data.identity.headline,
          dataJson: JSON.stringify(data),
        },
      })
    : await prisma.candidateProfile.create({
        data: {
          name: data.identity.name,
          headline: data.identity.headline,
          dataJson: JSON.stringify(data),
        },
      });

  await prisma.candidateDocument.create({
    data: {
      fileType: body.fileType,
      fileName: body.fileName,
      filePath: body.savedPath,
      extractedJson: JSON.stringify(body.extraction),
    },
  });

  return NextResponse.json({ id: record.id });
}
