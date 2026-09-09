import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { daysAgo, ACTIVITY_LABELS } from "@/lib/usageStats";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "30";
  const since = period === "all" ? undefined : daysAgo(Number(period));

  const [calls, companies] = await Promise.all([
    prisma.apiCall.findMany({ where: since ? { createdAt: { gte: since } } : {} }),
    prisma.company.findMany({ include: { _count: { select: { people: true, jobPostings: true } } } }),
  ]);

  const totalSpend = calls.reduce((s, c) => s + c.costUsd, 0);
  const rerunSpend = calls.filter((c) => c.isRerun).reduce((s, c) => s + c.costUsd, 0);

  const profileCalls = calls.filter((c) => c.activity === "extractPerson");
  const profileCost = calls
    .filter((c) => c.activity === "extractPerson" || c.activity === "mergePerson")
    .reduce((s, c) => s + c.costUsd, 0);
  const costPerProfile = profileCalls.length ? profileCost / profileCalls.length : 0;

  const planCalls = calls.filter((c) => c.activity === "analyzeJobFit");
  const costPerActionPlan = planCalls.length ? planCalls.reduce((s, c) => s + c.costUsd, 0) / planCalls.length : 0;

  const companiesById = new Map(companies.map((c) => [c.id, c]));
  const byCompanyId = new Map<number, typeof calls>();
  const notAttached: typeof calls = [];
  for (const call of calls) {
    if (call.companyId == null) {
      notAttached.push(call);
      continue;
    }
    const list = byCompanyId.get(call.companyId) ?? [];
    list.push(call);
    byCompanyId.set(call.companyId, list);
  }

  function sumByActivity(rows: typeof calls, activities: string[]) {
    const total = rows.filter((r) => activities.includes(r.activity)).reduce((s, r) => s + r.costUsd, 0);
    return total > 0 ? `$${total.toFixed(2)}` : "—";
  }

  const byCompany = Array.from(byCompanyId.entries())
    .map(([companyId, rows]) => {
      const company = companiesById.get(companyId);
      const total = rows.reduce((s, r) => s + r.costUsd, 0);
      return {
        id: companyId,
        name: company?.name ?? "Unknown",
        meta: company ? `${company._count.people} profiles · ${company._count.jobPostings} job descriptions` : "",
        profiles: sumByActivity(rows, ["extractPerson", "mergePerson", "captureSharedConnections"]),
        clusters: sumByActivity(rows, ["analyzeCompany"]),
        jds: sumByActivity(rows, ["importJobPosting"]),
        plans: sumByActivity(rows, ["analyzeJobFit"]),
        interviews: sumByActivity(rows, ["generateInterviewGuide"]),
        runs: rows.length,
        total: `$${total.toFixed(2)}`,
      };
    })
    .sort((a, b) => parseFloat(b.total.slice(1)) - parseFloat(a.total.slice(1)));

  const notAttachedTotal = notAttached.reduce((s, r) => s + r.costUsd, 0);

  const byActivityMap = new Map<string, { total: number; count: number }>();
  for (const call of calls) {
    const entry = byActivityMap.get(call.activity) ?? { total: 0, count: 0 };
    entry.total += call.costUsd;
    entry.count += 1;
    byActivityMap.set(call.activity, entry);
  }
  const byActivity = Array.from(byActivityMap.entries())
    .map(([activity, { total, count }]) => ({
      activity,
      label: ACTIVITY_LABELS[activity] ?? activity,
      total: `$${total.toFixed(2)}`,
      count,
      pct: totalSpend > 0 ? Math.round((total / totalSpend) * 100) : 0,
      color: activity === "analyzeJobFit" ? "var(--color-accent)" : "var(--color-neutral-900)",
      detail: `${count} call${count === 1 ? "" : "s"}`,
    }))
    .sort((a, b) => b.pct - a.pct);

  return NextResponse.json({
    stats: {
      totalSpend,
      costPerProfile,
      costPerActionPlan,
      rerunSpend,
    },
    byCompany,
    notAttached:
      notAttached.length > 0
        ? {
            meta: "Candidate profile imports, suggestions",
            total: `$${notAttachedTotal.toFixed(2)}`,
            runs: notAttached.length,
          }
        : null,
    byActivity,
  });
}
