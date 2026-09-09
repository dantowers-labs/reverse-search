import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, ctx: RouteContext<"/api/suggestions/[id]/dismiss">) {
  const { id } = await ctx.params;
  await prisma.suggestion.update({ where: { id: Number(id) }, data: { status: "dismissed" } });
  return NextResponse.json({ ok: true });
}
