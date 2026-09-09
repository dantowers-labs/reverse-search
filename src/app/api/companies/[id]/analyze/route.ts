import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeCompany } from "@/lib/pipelines/analyzeCompany";

export async function POST(_request: Request, ctx: RouteContext<"/api/companies/[id]/analyze">) {
  const { id } = await ctx.params;
  const companyId = Number(id);

  try {
    const run = await analyzeCompany(companyId);
    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 400 },
    );
  }
}

export async function GET(_request: Request, ctx: RouteContext<"/api/companies/[id]/analyze">) {
  const { id } = await ctx.params;
  const companyId = Number(id);

  const runs = await prisma.analysisRun.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: { clusters: true },
  });

  return NextResponse.json({ runs });
}
