import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchConnectionsToRealCompanies } from "@/lib/connectionMatching";

// The full list, for the Connections page's "by person" table. Fine to send
// unpaginated for a single-user local dataset (hundreds, not millions, of rows).
export async function GET() {
  const [connections, companies] = await Promise.all([
    prisma.connection.findMany({
      orderBy: { connectedOn: "desc" },
      select: { id: true, name: true, company: true, position: true, url: true, connectedOn: true },
    }),
    prisma.company.findMany({ select: { id: true, name: true } }),
  ]);

  // Invert the company->connections map into connection->company so each row
  // can carry which real project (if any) it matches, for the "at an
  // analyzed company" filter/tint — same live-matched data the dashboard's
  // connection-count badges use, just indexed the other direction.
  const matches = await matchConnectionsToRealCompanies(companies);
  const matchedCompanyByConnectionId = new Map<number, { id: number; name: string }>();
  for (const company of companies) {
    for (const conn of matches.get(company.id) ?? []) {
      matchedCompanyByConnectionId.set(conn.id, { id: company.id, name: company.name });
    }
  }

  return NextResponse.json({
    connections: connections.map((c) => ({ ...c, matchedCompany: matchedCompanyByConnectionId.get(c.id) ?? null })),
  });
}
