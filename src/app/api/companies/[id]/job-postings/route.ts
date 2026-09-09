import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, ctx: RouteContext<"/api/companies/[id]/job-postings">) {
  const { id } = await ctx.params;
  const jobPostings = await prisma.jobPosting.findMany({
    where: { companyId: Number(id) },
    orderBy: { createdAt: "desc" },
    include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return NextResponse.json({ jobPostings });
}
