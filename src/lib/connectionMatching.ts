import { prisma } from "./prisma";
// Re-exported for existing server-side callers — the pure string logic lives
// in companyNameMatching.ts (no prisma import) specifically so client
// components can import it directly without pulling Prisma's native SQLite
// bindings into the browser bundle. Client code MUST import from that file
// directly, not from here.
export { normalizeCompanyName, isLooseCompanyMatch } from "./companyNameMatching";
import { normalizeCompanyName, isLooseCompanyMatch } from "./companyNameMatching";

export interface MatchedConnection {
  id: number;
  name: string;
  company: string | null;
  position: string | null;
  connectedOn: Date | null;
}

// Finds 1st-degree connections whose captured Company loosely matches the
// given company name. Deliberately a PREFIX check (one normalized name must
// start with the other), not "contains anywhere" — containment-anywhere
// produces coincidental mid-word collisions (a 3-letter fragment like "ema"
// turns up inside "thyme market", "braemac", etc.), while a prefix
// relationship is what real name variants ("Northwind" / "Northwind Data",
// "MDS" / "Meridian Data Solutions") actually look like once normalized.
export async function findConnectionsAtCompany(companyName: string): Promise<MatchedConnection[]> {
  const target = normalizeCompanyName(companyName);
  if (target.length < 3) return []; // too short to match without noise (e.g. "AI", "Co")

  const connections = await prisma.connection.findMany({ where: { company: { not: null } } });
  return connections
    .filter((c) => isLooseCompanyMatch(normalizeCompanyName(c.company!), target))
    .map((c) => ({ id: c.id, name: c.name, company: c.company, position: c.position, connectedOn: c.connectedOn }));
}

export interface RealCompanyRef {
  id: number;
  name: string;
}

// Matches every imported Connection against the small set of real Company
// projects (not the ~hundreds-strong tracker pool) in one pass — same loose
// prefix logic as findConnectionsAtCompany above, just run once for the whole
// company list instead of once per company. Feeds the Connections page's
// "by company" analyzed-projects group, the "at an analyzed company"
// filter/tint on its "by person" table, and the connection-count badges on
// the dashboard and company header. Computed live on every request rather
// than persisted (matches this app's existing convention for the dashboard
// lead/staleness) — a stored matchedCompanyId set at import time would go
// stale the moment a new Company project is opened after that import.
export async function matchConnectionsToRealCompanies(
  companies: RealCompanyRef[],
): Promise<Map<number, MatchedConnection[]>> {
  // Sorted longest-normalized-first: with two prefix-overlapping projects
  // open at once (the exact "Insight" vs "Insight Global" case
  // normalizeCompanyName's own comment calls out as different real
  // companies), a connection at "Insight Global" satisfies the predicate for
  // both — find() must hit the more specific (longer) one first, not
  // whichever company happens to sort first by createdAt.
  const normalizedCompanies = companies
    .map((c) => ({ ...c, normalized: normalizeCompanyName(c.name) }))
    .filter((c) => c.normalized.length >= 3)
    .sort((a, b) => b.normalized.length - a.normalized.length);
  const connections = await prisma.connection.findMany({ where: { company: { not: null } } });

  const byCompanyId = new Map<number, MatchedConnection[]>(companies.map((c) => [c.id, []]));
  for (const conn of connections) {
    const candidate = normalizeCompanyName(conn.company!);
    if (candidate.length < 3) continue;
    const match = normalizedCompanies.find((c) => isLooseCompanyMatch(candidate, c.normalized));
    if (match) {
      byCompanyId.get(match.id)!.push({
        id: conn.id,
        name: conn.name,
        company: conn.company,
        position: conn.position,
        connectedOn: conn.connectedOn,
      });
    }
  }
  return byCompanyId;
}
