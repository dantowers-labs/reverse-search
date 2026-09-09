import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Summary for the dashboard's import affordance — count + freshness, not the
// full list (which can be in the thousands).
export async function GET() {
  const [count, mostRecent] = await Promise.all([
    prisma.connection.count(),
    prisma.connection.findFirst({ orderBy: { importedAt: "desc" }, select: { importedAt: true } }),
  ]);
  return NextResponse.json({ count, lastImportedAt: mostRecent?.importedAt ?? null });
}
