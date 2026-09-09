import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchConnectionsToRealCompanies } from "@/lib/connectionMatching";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { people: true, jobPostings: true, interviews: true } },
      analysisRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const connectionMatches = await matchConnectionsToRealCompanies(
    companies.map((c) => ({ id: c.id, name: c.name })),
  );

  return NextResponse.json({
    companies: companies.map((c) => {
      const latestRun = c.analysisRuns[0] ?? null;
      const isStale = latestRun != null && latestRun.personCountAtRun < c._count.people;
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        sector: c.sector,
        researchNotes: c.researchNotes,
        dismissedAt: c.dismissedAt,
        personCount: c._count.people,
        jobPostingCount: c._count.jobPostings,
        interviewCount: c._count.interviews,
        connectionCount: connectionMatches.get(c.id)?.length ?? 0,
        isStale,
        latestAnalysis: latestRun
          ? {
              overallVerdict: latestRun.overallVerdict,
              overallScore: latestRun.overallScore,
              createdAt: latestRun.createdAt,
            }
          : null,
      };
    }),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { name: string; sector?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slug = slugify(body.name);
  const company = await prisma.company.upsert({
    where: { slug },
    update: {},
    create: { name: body.name.trim(), slug, sector: body.sector ?? null },
  });

  return NextResponse.json({ company });
}
