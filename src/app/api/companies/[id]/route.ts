import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, ctx: RouteContext<"/api/companies/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json()) as { researchNotes?: string | null; dismissed?: boolean };

  const company = await prisma.company.update({
    where: { id: Number(id) },
    data: {
      ...(body.researchNotes !== undefined && { researchNotes: body.researchNotes?.trim() || null }),
      ...(body.dismissed !== undefined && { dismissedAt: body.dismissed ? new Date() : null }),
    },
  });
  return NextResponse.json({ company });
}
