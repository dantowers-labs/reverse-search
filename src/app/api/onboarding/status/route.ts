import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Drives the dashboard's "Getting started" checklist — cheap existence
// checks, not full records.
export async function GET() {
  const [profile, connectionCount, trackerCompanyCount, companyCount] = await Promise.all([
    prisma.candidateProfile.findFirst({ select: { id: true } }),
    prisma.connection.count(),
    prisma.trackerCompany.count(),
    prisma.company.count(),
  ]);

  return NextResponse.json({
    hasProfile: profile != null,
    hasConnections: connectionCount > 0,
    hasTrackerCompanies: trackerCompanyCount > 0,
    hasCompanies: companyCount > 0,
  });
}
