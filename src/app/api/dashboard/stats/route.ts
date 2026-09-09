import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSpendTotals } from "@/lib/usageStats";

// The Companies list page's 4-stat strip: profiles captured, job descriptions
// imported, analyses out of date (companies where more people were captured
// since the last cluster run than the run itself covered), and 30-day spend.
export async function GET() {
  const [personCount, jobPostingCount, companies, spend] = await Promise.all([
    prisma.personProfile.count(),
    prisma.jobPosting.count(),
    prisma.company.findMany({
      include: { _count: { select: { people: true } }, analysisRuns: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    getSpendTotals(),
  ]);

  const staleCount = companies.filter((c) => {
    const latestRun = c.analysisRuns[0];
    return latestRun != null && latestRun.personCountAtRun < c._count.people;
  }).length;

  return NextResponse.json({
    personCount,
    jobPostingCount,
    staleCount,
    last30dSpend: spend.last30dTotal,
  });
}
