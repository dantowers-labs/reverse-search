import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, CLAUDE_FAST_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { SharedConnectionsExtractionSchema } from "@/lib/schemas";
import { recordApiCall } from "@/lib/usageTracking";

const IMAGE_MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

// LinkedIn shows 5 mutual connections at a time, so a person with more than
// that takes 2+ screenshots. Each capture merges into whatever's already
// there rather than replacing it, deduped by name — no LLM call needed for
// the merge itself, this is just a list union.
function mergeConnections(
  existing: { name: string; headline: string | null }[],
  incoming: { name: string; headline: string | null }[],
) {
  const byKey = new Map<string, { name: string; headline: string | null }>();
  for (const c of [...existing, ...incoming]) {
    const key = c.name.trim().toLowerCase();
    if (!byKey.has(key)) byKey.set(key, c);
  }
  return [...byKey.values()];
}

// LinkedIn's profile export (PDF) does not include the "X mutual connections"
// panel — this is captured separately, per person, only when the candidate
// chooses to grab it. What's extracted is the candidate's OWN network (people
// they're already connected to), not the target profile itself — the target
// person's own name (when visible) is captured separately by extractPerson.ts.
export async function captureSharedConnections(personId: number, fileName: string, buffer: Buffer) {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const isPdf = ext === "pdf";
  const imageMediaType = IMAGE_MEDIA_TYPES[ext];
  if (!isPdf && !imageMediaType) {
    throw new Error(`Unsupported file type ".${ext}" — use an image or a PDF`);
  }

  const person = await prisma.personProfile.findUniqueOrThrow({ where: { id: personId } });

  const response = await anthropic.messages.parse({
    model: CLAUDE_FAST_MODEL,
    max_tokens: 2000,
    output_config: { format: zodOutputFormat(SharedConnectionsExtractionSchema) },
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
          {
            type: "text" as const,
            text: "This is a screenshot of LinkedIn's \"mutual connections\" / \"X of your connections know this person\" panel. Extract the list of people shown — these are the candidate's own connections, not the profile owner. For each, capture their name and headline if visible.",
          },
        ],
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Shared-connections extraction did not parse");
  }

  await recordApiCall({
    activity: "captureSharedConnections",
    model: CLAUDE_FAST_MODEL,
    usage: response.usage,
    companyId: person.companyId,
  });

  const savedPath = saveUploadedFile(
    `companies/${person.companyId}/people/${personId}/shared-connections`,
    fileName,
    buffer,
  );

  const existingConnections: { name: string; headline: string | null }[] = person.sharedConnectionsJson
    ? JSON.parse(person.sharedConnectionsJson)
    : [];
  const merged = mergeConnections(existingConnections, response.parsed_output.connections);

  await prisma.personProfile.update({
    where: { id: personId },
    data: {
      sharedConnectionsJson: JSON.stringify(merged),
      sharedConnectionsImage: savedPath,
    },
  });

  return merged;
}
