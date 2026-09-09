import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, ctx: RouteContext<"/api/role-clusters/[id]">) {
  const { id } = await ctx.params;
  const cluster = await prisma.roleCluster.findUnique({
    where: { id: Number(id) },
    include: {
      analysisRun: { include: { company: true } },
      associatedPostings: {
        include: { jobPosting: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!cluster) return NextResponse.json({ error: "Cluster not found" }, { status: 404 });

  const memberIds: number[] = JSON.parse(cluster.memberPersonProfileIdsJson);
  const members = await prisma.personProfile.findMany({ where: { id: { in: memberIds } } });
  // Preserve the LLM's original ordering (findMany with `in` doesn't guarantee it)
  const membersById = new Map(members.map((m) => [m.id, m]));
  const orderedMembers = memberIds.map((id) => membersById.get(id)).filter((m) => m != null);

  return NextResponse.json({
    cluster: {
      id: cluster.id,
      clusterLabel: cluster.clusterLabel,
      aggregateSummary: cluster.aggregateSummary,
      fitScore: cluster.fitScore,
      fitVerdict: cluster.fitVerdict,
      // Pre-migration runs only ever wrote the legacy blob — fall back to it
      // as the "pro" case so old clusters still render sensibly; they never
      // had a divergence case asked for, so that stays null until re-run.
      alignmentReasoning: cluster.alignmentReasoning ?? cluster.fitReasoning ?? "",
      divergenceReasoning: cluster.divergenceReasoning,
      company: { slug: cluster.analysisRun.company.slug, name: cluster.analysisRun.company.name },
      members: orderedMembers.map((m) => ({
        id: m.id,
        mergedName: m.mergedName,
        mergedTitle: m.mergedTitle,
        mergedHeadline: m.mergedHeadline,
      })),
      associatedPostings: cluster.associatedPostings.map((a) => ({
        jobPostingAnalysisId: a.id,
        jobPostingId: a.jobPosting.id,
        title: a.jobPosting.title,
        fitScore: a.fitScore,
        verdict: a.verdict,
        associatedClusterBasis: a.associatedClusterBasis,
      })),
    },
  });
}
