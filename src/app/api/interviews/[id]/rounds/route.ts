import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, ctx: RouteContext<"/api/interviews/[id]/rounds">) {
  const { id } = await ctx.params;
  const interviewId = Number(id);
  const body = (await request.json()) as {
    stage: string;
    interviewerName: string;
    interviewerPersonId?: number | null;
    date?: string | null;
  };

  if (!body.stage?.trim() || !body.interviewerName?.trim()) {
    return NextResponse.json({ error: "stage and interviewerName are required" }, { status: 400 });
  }

  const count = await prisma.interviewRound.count({ where: { interviewId } });
  const date = body.date ? new Date(body.date) : null;
  const round = await prisma.interviewRound.create({
    data: {
      interviewId,
      sequence: count + 1,
      stage: body.stage.trim(),
      interviewerName: body.interviewerName.trim(),
      interviewerPersonId: body.interviewerPersonId ?? null,
      date,
      state: date ? "IN_PROGRESS" : "NOT_SCHEDULED",
    },
  });
  await prisma.opportunityEvent.create({
    data: { interviewId, roundId: round.id, type: "round", date: date ?? round.createdAt },
  });
  return NextResponse.json({ round });
}
