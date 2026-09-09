import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, ctx: RouteContext<"/api/interviews/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json()) as { disposition?: string | null; label?: string | null; jobPostingId?: number | null };

  const interview = await prisma.interview.update({
    where: { id: Number(id) },
    data: {
      ...(body.disposition !== undefined && { disposition: body.disposition?.trim() || null }),
      ...(body.label !== undefined && { label: body.label?.trim() || null }),
      ...(body.jobPostingId !== undefined && { jobPostingId: body.jobPostingId }),
    },
  });
  return NextResponse.json({ interview });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/interviews/[id]">) {
  const { id } = await ctx.params;
  await prisma.interview.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
