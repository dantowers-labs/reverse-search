import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Logs a freestanding contact touchpoint on an interview thread — no round,
// just a dated note (e.g. "connected with the hiring manager"). A genuinely
// new primitive the timeline enables; there was no prior equivalent.
export async function POST(request: Request, ctx: RouteContext<"/api/interviews/[id]/events">) {
  const { id } = await ctx.params;
  const body = (await request.json()) as { note: string; date?: string | null };

  if (!body.note?.trim()) {
    return NextResponse.json({ error: "note is required" }, { status: 400 });
  }

  const event = await prisma.opportunityEvent.create({
    data: {
      interviewId: Number(id),
      type: "contact",
      note: body.note.trim(),
      date: body.date ? new Date(body.date) : new Date(),
    },
  });
  return NextResponse.json({ event });
}
