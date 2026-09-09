import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractAndCreatePerson, extractAndCreatePeopleBulk } from "@/lib/pipelines/extractPerson";
import { findConnectionsAtCompany } from "@/lib/connectionMatching";
import { normalizePersonName } from "@/lib/personDisplay";

export async function GET(_request: Request, ctx: RouteContext<"/api/companies/[id]/people">) {
  const { id } = await ctx.params;
  const companyId = Number(id);
  const [company, people] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    prisma.personProfile.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      include: { images: true },
    }),
  ]);

  // A captured person who's also a real LinkedIn connection — a much
  // stronger signal than anything derived from cluster fit, so it's flagged
  // independent of the shared-employer check below (different sources, both
  // worth surfacing). Matched by name against the same bulk-connections
  // fuzzy-company-match already used for outreach targeting, not a new path.
  const knownConnections = await findConnectionsAtCompany(company.name);
  const knownConnectionNames = new Set(knownConnections.map((c) => normalizePersonName(c.name)));

  return NextResponse.json({
    people: people.map((p) => ({
      ...p,
      isKnownConnection: p.mergedName != null && knownConnectionNames.has(normalizePersonName(p.mergedName)),
    })),
  });
}

// Full reset for a company's research: clears people (and their screenshots via
// cascade), plus analysis runs and chat, since both were built on the data being
// cleared and would otherwise linger as stale/misleading context.
export async function DELETE(_request: Request, ctx: RouteContext<"/api/companies/[id]/people">) {
  const { id } = await ctx.params;
  const companyId = Number(id);

  const [{ count: peopleDeleted }] = await prisma.$transaction([
    prisma.personProfile.deleteMany({ where: { companyId } }),
    prisma.analysisRun.deleteMany({ where: { companyId } }), // cascades to RoleCluster
    prisma.chatMessage.deleteMany({ where: { companyId } }),
  ]);

  return NextResponse.json({ peopleDeleted });
}

export async function POST(request: Request, ctx: RouteContext<"/api/companies/[id]/people">) {
  const { id } = await ctx.params;
  const companyId = Number(id);

  const form = await request.formData();
  const fileEntries = form.getAll("files").filter((f): f is File => f instanceof File);
  const mode = String(form.get("mode") ?? "single"); // "single" = 1 person, N files (merge); "bulk" = N people, 1 file each

  if (fileEntries.length === 0) {
    return NextResponse.json({ error: "No files provided under 'files'" }, { status: 400 });
  }

  const files = await Promise.all(
    fileEntries.map(async (f) => ({ name: f.name, buffer: Buffer.from(await f.arrayBuffer()) })),
  );

  try {
    if (mode === "bulk") {
      const { personIds, errors, duplicates } = await extractAndCreatePeopleBulk(companyId, files);
      return NextResponse.json({ personIds, errors, duplicates });
    }
    const personId = await extractAndCreatePerson(companyId, files);
    return NextResponse.json({ personId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 400 },
    );
  }
}
