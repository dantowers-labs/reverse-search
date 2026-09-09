import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, ctx: RouteContext<"/api/job-postings/[id]">) {
  const { id } = await ctx.params;
  const jobPosting = await prisma.jobPosting.findUnique({
    where: { id: Number(id) },
    include: {
      company: { select: { slug: true, name: true } },
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!jobPosting) return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
  return NextResponse.json({ jobPosting });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/job-postings/[id]">) {
  const { id } = await ctx.params;
  await prisma.jobPosting.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
