import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, ctx: RouteContext<"/api/suggestions/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json()) as { feedbackNote?: string | null; status?: string };

  const suggestion = await prisma.suggestion.update({
    where: { id: Number(id) },
    data: {
      ...(body.feedbackNote !== undefined && { feedbackNote: body.feedbackNote?.trim() || null }),
      // Used by the dashboard's dismiss-undo link — sets status back to "new"
      // within the undo window rather than adding a separate endpoint for it.
      ...(body.status !== undefined && { status: body.status }),
    },
  });
  return NextResponse.json({ suggestion });
}
