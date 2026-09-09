import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { CandidateProfileData } from "@/lib/schemas";

export async function GET() {
  const [profile, documents, analysisRunCount, jobPostingAnalysisCount] = await Promise.all([
    prisma.candidateProfile.findFirst(),
    prisma.candidateDocument.findMany({ orderBy: { ingestedAt: "desc" } }),
    prisma.analysisRun.count(),
    prisma.jobPostingAnalysis.count(),
  ]);

  const hasDependentAnalyses = analysisRunCount > 0 || jobPostingAnalysisCount > 0;

  if (!profile) {
    return NextResponse.json({ profile: null, documents, hasDependentAnalyses });
  }
  return NextResponse.json({
    profile: {
      id: profile.id,
      name: profile.name,
      headline: profile.headline,
      data: JSON.parse(profile.dataJson) as CandidateProfileData,
      updatedAt: profile.updatedAt,
    },
    documents,
    hasDependentAnalyses,
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { data: CandidateProfileData };
  const existing = await prisma.candidateProfile.findFirst();

  const record = existing
    ? await prisma.candidateProfile.update({
        where: { id: existing.id },
        data: {
          name: body.data.identity.name,
          headline: body.data.identity.headline,
          dataJson: JSON.stringify(body.data),
        },
      })
    : await prisma.candidateProfile.create({
        data: {
          name: body.data.identity.name,
          headline: body.data.identity.headline,
          dataJson: JSON.stringify(body.data),
        },
      });

  return NextResponse.json({ id: record.id });
}
