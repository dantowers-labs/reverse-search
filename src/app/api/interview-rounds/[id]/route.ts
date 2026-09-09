import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Feeds the round detail route (/company/[slug]/round/[roundId]).
export async function GET(_request: Request, ctx: RouteContext<"/api/interview-rounds/[id]">) {
  const { id } = await ctx.params;
  const round = await prisma.interviewRound.findUnique({
    where: { id: Number(id) },
    include: {
      interviewerPerson: true,
      interview: { include: { company: true, jobPosting: true } },
    },
  });
  if (!round) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ round });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/interview-rounds/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    stage?: string;
    interviewerName?: string;
    interviewerPersonId?: number | null;
    notes?: string | null;
    date?: string | null;
    state?: string | null;
  };

  const date = body.date !== undefined ? (body.date ? new Date(body.date) : null) : undefined;
  const round = await prisma.interviewRound.update({
    where: { id: Number(id) },
    data: {
      ...(body.stage !== undefined && { stage: body.stage.trim() }),
      ...(body.interviewerName !== undefined && { interviewerName: body.interviewerName.trim() }),
      ...(body.interviewerPersonId !== undefined && { interviewerPersonId: body.interviewerPersonId }),
      ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
      ...(date !== undefined && { date }),
      ...(body.state !== undefined && { state: body.state?.trim() || null }),
    },
  });

  // Keep the timeline's sort key in sync — the round's own date can change
  // (scheduled, then rescheduled) after its event row was first written.
  if (date !== undefined) {
    await prisma.opportunityEvent.updateMany({
      where: { roundId: round.id },
      data: { date: date ?? round.createdAt },
    });
  }

  return NextResponse.json({ round });
}

// Only the highest-sequence round for its opportunity can be deleted, so
// `sequence` stays contiguous and "prior rounds = sequence < N" stays simple.
export async function DELETE(_request: Request, ctx: RouteContext<"/api/interview-rounds/[id]">) {
  const { id } = await ctx.params;
  const round = await prisma.interviewRound.findUniqueOrThrow({ where: { id: Number(id) } });
  const latest = await prisma.interviewRound.findFirst({
    where: { interviewId: round.interviewId },
    orderBy: { sequence: "desc" },
  });
  if (latest?.id !== round.id) {
    return NextResponse.json({ error: "Only the most recent round can be deleted" }, { status: 400 });
  }
  await prisma.interviewRound.delete({ where: { id: round.id } });
  return NextResponse.json({ ok: true });
}
