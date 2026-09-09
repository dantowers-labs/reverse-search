import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSuggestions } from "@/lib/pipelines/generateSuggestions";

export async function GET() {
  const [suggestions, settings] = await Promise.all([
    prisma.suggestion.findMany({
      where: { status: "new" },
      orderBy: { createdAt: "desc" },
      include: { trackerCompany: true },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  // Sorted in JS rather than via Prisma orderBy so null priority/confidence
  // values (the common case until a CSV's been mapped through the wizard)
  // sort predictably last regardless of SQLite's default null ordering.
  const strategy = settings?.trackerRankingStrategy ?? "priorityFitTiebreak";
  const sorted = [...suggestions].sort((a, b) => {
    const priorityA = a.trackerCompany.priority;
    const priorityB = b.trackerCompany.priority;
    if (strategy !== "fitOnly") {
      if (priorityA != null && priorityB != null && priorityA !== priorityB) return priorityA - priorityB;
      if (priorityA != null && priorityB == null) return -1;
      if (priorityA == null && priorityB != null) return 1;
      if (strategy === "priorityOnly") return 0;
    }
    return (b.confidenceScore ?? -1) - (a.confidenceScore ?? -1);
  });

  return NextResponse.json({ suggestions: sorted });
}

// Regenerates suggestions from the current fit signature + tracker pool.
export async function POST() {
  try {
    const result = await generateSuggestions();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Suggestion generation failed" },
      { status: 400 },
    );
  }
}
