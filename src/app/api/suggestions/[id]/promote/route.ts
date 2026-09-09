import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(_request: Request, ctx: RouteContext<"/api/suggestions/[id]/promote">) {
  const { id } = await ctx.params;
  const suggestion = await prisma.suggestion.findUniqueOrThrow({
    where: { id: Number(id) },
    include: { trackerCompany: true },
  });

  const slug = slugify(suggestion.trackerCompany.name);
  const company = await prisma.company.upsert({
    where: { slug },
    update: {},
    create: {
      name: suggestion.trackerCompany.name,
      slug,
      sector: suggestion.trackerCompany.sector,
      researchNotes: suggestion.feedbackNote ?? null,
    },
  });

  await prisma.suggestion.update({ where: { id: suggestion.id }, data: { status: "promoted" } });

  return NextResponse.json({ company });
}
