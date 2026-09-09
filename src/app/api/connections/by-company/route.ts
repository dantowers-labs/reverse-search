import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeCompanyName, matchConnectionsToRealCompanies } from "@/lib/connectionMatching";

// Feeds the Connections page's "by company" view (default segment): the
// companies the candidate is actively analyzing come first as their own
// group — every one of them, including zero-connection rows, so it reads as
// real coverage rather than a curated highlight reel — followed by the top 18
// other companies by raw connection volume, with anything already counted in
// the first group excluded so it isn't shown twice.
export async function GET() {
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });

  const matched = await matchConnectionsToRealCompanies(companies);
  const analyzed = companies.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    connections: matched.get(c.id) ?? [],
  }));

  const matchedConnectionIds = new Set(
    Array.from(matched.values()).flatMap((conns) => conns.map((c) => c.id)),
  );

  const allConnections = await prisma.connection.findMany({
    where: { company: { not: null } },
    select: { id: true, name: true, company: true, position: true, connectedOn: true },
  });

  const buckets = new Map<
    string,
    { label: string; connections: { id: number; name: string; company: string | null; position: string | null; connectedOn: Date | null }[] }
  >();
  for (const c of allConnections) {
    if (matchedConnectionIds.has(c.id)) continue; // already counted under an analyzed company
    const key = normalizeCompanyName(c.company!);
    if (key.length < 2) continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.connections.push(c);
    else buckets.set(key, { label: c.company!, connections: [c] });
  }

  const topOther = Array.from(buckets.values())
    .sort((a, b) => b.connections.length - a.connections.length)
    .slice(0, 18);

  return NextResponse.json({ analyzed, topOther });
}
