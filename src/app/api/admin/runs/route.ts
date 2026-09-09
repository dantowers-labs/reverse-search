import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACTIVITY_LABELS } from "@/lib/usageStats";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 10), 50);

  const calls = await prisma.apiCall.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { company: { select: { name: true } } },
  });

  return NextResponse.json({
    runs: calls.map((c) => ({
      id: c.id,
      when: c.createdAt,
      activity: ACTIVITY_LABELS[c.activity] ?? c.activity,
      company: c.company?.name ?? "—",
      tokensIn: c.inputTokens,
      tokensOut: c.outputTokens,
      cost: c.costUsd,
    })),
  });
}
