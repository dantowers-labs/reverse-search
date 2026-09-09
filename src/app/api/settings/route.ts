import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Singleton row (id 1), upserted lazily — same pattern as CandidateProfile's
// findFirst-or-null, except AppSettings always has a sensible schema default
// so GET can just upsert-on-read instead of returning null.
export async function GET() {
  const settings = await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    trackerRankingStrategy?: string;
    trackerExtraColumnsPolicy?: string;
    trackerLastPath?: string;
    trackerLastMappingJson?: string;
    staleThresholdDays?: number;
    vectorMapEnabled?: boolean;
  };

  const settings = await prisma.appSettings.upsert({
    where: { id: 1 },
    update: body,
    create: { id: 1, ...body },
  });
  return NextResponse.json({ settings });
}
