import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeJobFit } from "@/lib/pipelines/analyzeJobFit";

export async function POST(_request: Request, ctx: RouteContext<"/api/job-postings/[id]/analyze">) {
  const { id } = await ctx.params;
  try {
    const analysis = await analyzeJobFit(Number(id));
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error(`analyzeJobFit failed for job posting ${id}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 400 },
    );
  }
}

export async function GET(_request: Request, ctx: RouteContext<"/api/job-postings/[id]/analyze">) {
  const { id } = await ctx.params;
  const analyses = await prisma.jobPostingAnalysis.findMany({
    where: { jobPostingId: Number(id) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ analyses });
}
