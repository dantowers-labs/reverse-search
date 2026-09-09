import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { CandidateProfileData } from "@/lib/schemas";
import { pcaProject2D } from "@/lib/pca";

function personText(p: { mergedTitle: string | null; mergedHeadline: string | null; mergedAbout: string | null; mergedSkillsJson: string | null }) {
  const skills: string[] = p.mergedSkillsJson ? JSON.parse(p.mergedSkillsJson) : [];
  return [p.mergedTitle, p.mergedHeadline, p.mergedAbout, skills.join(", ")].filter(Boolean).join(". ");
}

function candidateText(data: CandidateProfileData) {
  const experience = data.experience.map((e) => `${e.title} at ${e.company}: ${e.description}`).join(" ");
  const skills = [...data.skills.primary, ...data.skills.secondary, ...data.skills.domain, ...data.skills.software].join(", ");
  return [data.identity.headline, experience, skills].filter(Boolean).join(". ");
}

export async function GET(_request: Request, ctx: RouteContext<"/api/companies/[id]/embeddings-map">) {
  const { id } = await ctx.params;
  const companyId = Number(id);

  const settings = await prisma.appSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  if (!settings.vectorMapEnabled) {
    return NextResponse.json({ enabled: false });
  }
  if (!process.env.VOYAGE_API_KEY) {
    return NextResponse.json({ enabled: false, missingApiKey: true });
  }

  // Only imported once the checks above pass, so a request that doesn't
  // use this feature never touches Voyage-specific code at all.
  const { embedTexts } = await import("@/lib/embeddings");

  const [people, candidateProfile, latestRun] = await Promise.all([
    prisma.personProfile.findMany({ where: { companyId } }),
    prisma.candidateProfile.findFirst(),
    prisma.analysisRun.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" }, include: { clusters: true } }),
  ]);

  if (!candidateProfile) {
    return NextResponse.json({ error: "No candidate profile set up yet" }, { status: 400 });
  }
  if (people.length < 2) {
    return NextResponse.json({ enabled: true, tooFew: true, candidate: null, people: [] });
  }

  const clusterLabelByPersonId = new Map<number, string>();
  if (latestRun) {
    for (const cl of latestRun.clusters) {
      const memberIds: number[] = JSON.parse(cl.memberPersonProfileIdsJson);
      for (const mid of memberIds) clusterLabelByPersonId.set(mid, cl.clusterLabel);
    }
  }

  // Candidate profile isn't cached (single row, cheap to recompute); people
  // missing a cached embedding get backfilled in one batched call rather
  // than one request per profile.
  const candidateData: CandidateProfileData = JSON.parse(candidateProfile.dataJson);
  const peopleNeedingEmbeddings = people.filter((p) => !p.embeddingJson);
  const textsToEmbed = [candidateText(candidateData), ...peopleNeedingEmbeddings.map(personText)];
  const freshVectors = await embedTexts(textsToEmbed);

  const candidateVector = freshVectors[0];
  await Promise.all(
    peopleNeedingEmbeddings.map((p, i) =>
      prisma.personProfile.update({ where: { id: p.id }, data: { embeddingJson: JSON.stringify(freshVectors[i + 1]) } }),
    ),
  );

  const vectorByPersonId = new Map<number, number[]>();
  for (const p of people) {
    if (p.embeddingJson) vectorByPersonId.set(p.id, JSON.parse(p.embeddingJson));
  }
  peopleNeedingEmbeddings.forEach((p, i) => vectorByPersonId.set(p.id, freshVectors[i + 1]));

  const allVectors = [candidateVector, ...people.map((p) => vectorByPersonId.get(p.id)!)];
  const projected = pcaProject2D(allVectors);

  return NextResponse.json({
    enabled: true,
    tooFew: false,
    candidate: { x: projected[0][0], y: projected[0][1] },
    people: people.map((p, i) => ({
      id: p.id,
      name: p.mergedName,
      title: p.mergedTitle ?? p.mergedHeadline,
      clusterLabel: clusterLabelByPersonId.get(p.id) ?? null,
      x: projected[i + 1][0],
      y: projected[i + 1][1],
    })),
  });
}
