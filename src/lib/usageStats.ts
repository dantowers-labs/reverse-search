import { prisma } from "@/lib/prisma";

export const ACTIVITY_LABELS: Record<string, string> = {
  analyzeCompany: "Cluster analysis",
  analyzeJobFit: "Action plan",
  importJobPosting: "Job description import",
  generateSuggestions: "Suggestions",
  extractPerson: "Profile extraction",
  mergePerson: "Profile merge",
  captureSharedConnections: "Shared connections",
  candidateProfileExtract: "Candidate profile extraction",
  candidateProfileChangeset: "Candidate profile changeset",
  candidateProfileApply: "Candidate profile apply",
  chat: "Chat",
  generateInterviewGuide: "Interview guide",
};

// Shared by the header/dashboard spend figure and the Admin screen's
// aggregations, so the "last 30 days" window logic lives in one place.
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Used to show a real cost estimate before a bulk action (e.g. "Analyze all"
// on the Job descriptions tab) — null when there's no history yet to
// estimate from, rather than guessing.
export async function getActivityAverageCost(activity: string): Promise<number | null> {
  const agg = await prisma.apiCall.aggregate({ where: { activity }, _avg: { costUsd: true }, _count: true });
  return agg._count > 0 ? agg._avg.costUsd : null;
}

export async function getSpendTotals() {
  const since30d = daysAgo(30);
  const [last30, allTime] = await Promise.all([
    prisma.apiCall.aggregate({ where: { createdAt: { gte: since30d } }, _sum: { costUsd: true } }),
    prisma.apiCall.aggregate({ _sum: { costUsd: true } }),
  ]);
  return {
    last30dTotal: last30._sum.costUsd ?? 0,
    allTimeTotal: allTime._sum.costUsd ?? 0,
  };
}
