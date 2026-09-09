import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findConnectionsAtCompany } from "@/lib/connectionMatching";

// DO NEXT for the Network page: tracker companies where the candidate already
// has a 1st-degree connection but hasn't opened a project yet. Pure code, no
// LLM call — the same fuzzy matching used in suggestions/outreach, just
// surfaced directly instead of folded into a model's reasoning.
export async function GET() {
  const [trackerCompanies, existingCompanies] = await Promise.all([
    prisma.trackerCompany.findMany(),
    prisma.company.findMany({ select: { name: true } }),
  ]);
  const existingNames = new Set(existingCompanies.map((c) => c.name.toLowerCase()));
  const candidatePool = trackerCompanies.filter((t) => !existingNames.has(t.name.toLowerCase()));

  const withMatches = await Promise.all(
    candidatePool.map(async (t) => ({
      trackerCompanyId: t.id,
      name: t.name,
      sector: t.sector,
      connections: await findConnectionsAtCompany(t.name),
    })),
  );

  const withHits = withMatches.filter((o) => o.connections.length > 0);

  // Two different tracker rows can independently match the exact same set of
  // connections (e.g. "Insight" and "Insight Global" as separate real
  // applications, both matching the same LinkedIn "Insight Global" contacts)
  // — that's not two distinct opportunities, it's one, so merge on identical
  // match sets rather than rendering duplicate cards.
  const bySignature = new Map<string, { trackerCompanyIds: number[]; names: string[]; sector: string | null; connections: (typeof withHits)[number]["connections"] }>();
  for (const o of withHits) {
    const signature = [...o.connections.map((c) => c.id)].sort((a, b) => a - b).join(",");
    const existing = bySignature.get(signature);
    if (existing) {
      existing.trackerCompanyIds.push(o.trackerCompanyId);
      existing.names.push(o.name);
    } else {
      bySignature.set(signature, {
        trackerCompanyIds: [o.trackerCompanyId],
        names: [o.name],
        sector: o.sector,
        connections: o.connections,
      });
    }
  }

  const opportunities = Array.from(bySignature.values())
    .map((o) => ({
      trackerCompanyIds: o.trackerCompanyIds,
      name: o.names[0],
      // Other tracker rows that collided on the exact same connection set —
      // shown as a caveat, not silently merged into one fabricated name.
      alsoMatchedNames: o.names.length > 1 ? o.names.slice(1) : undefined,
      sector: o.sector,
      connections: o.connections,
    }))
    .sort((a, b) => b.connections.length - a.connections.length);

  return NextResponse.json({ opportunities });
}
