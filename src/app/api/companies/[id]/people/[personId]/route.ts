import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/companies/[id]/people/[personId]">,
) {
  const { id, personId } = await ctx.params;

  const person = await prisma.personProfile.findUnique({ where: { id: Number(personId) } });
  if (!person || person.companyId !== Number(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cascades to ScreenshotImage rows (onDelete: Cascade in schema).
  await prisma.personProfile.delete({ where: { id: person.id } });

  return NextResponse.json({ ok: true });
}
