import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, ctx: RouteContext<"/api/companies/[id]/interviews">) {
  const { id } = await ctx.params;
  const interviews = await prisma.interview.findMany({
    where: { companyId: Number(id) },
    orderBy: { createdAt: "desc" },
    include: {
      jobPosting: { select: { id: true, title: true } },
      rounds: {
        orderBy: { sequence: "asc" },
        include: { interviewerPerson: { select: { id: true, mergedName: true, mergedTitle: true } } },
      },
      // The timeline reads this — a thin index of everything that's happened
      // on this thread (rounds, the opening itself, free-text contact
      // touchpoints). The frontend cross-references roundId against the
      // rounds array above rather than this route duplicating round detail.
      events: { orderBy: { date: "desc" } },
    },
  });
  return NextResponse.json({ interviews });
}

export async function POST(request: Request, ctx: RouteContext<"/api/companies/[id]/interviews">) {
  const { id } = await ctx.params;
  const body = (await request.json()) as { jobPostingId?: number | null; label?: string | null };

  const interview = await prisma.interview.create({
    data: {
      companyId: Number(id),
      jobPostingId: body.jobPostingId ?? null,
      label: body.label?.trim() || null,
    },
  });
  // Every opportunity's opening is itself a timeline entry — written here
  // rather than left implicit so the timeline can read one table for
  // everything instead of separately reasoning about Interview.createdAt.
  await prisma.opportunityEvent.create({
    data: { interviewId: interview.id, type: "opened", date: interview.createdAt },
  });
  return NextResponse.json({ interview });
}
