import { NextResponse } from "next/server";
import { getActivityAverageCost } from "@/lib/usageStats";

// Backs the cost estimate shown before a bulk action (e.g. "Analyze all").
export async function GET(request: Request) {
  const activity = new URL(request.url).searchParams.get("activity");
  if (!activity) return NextResponse.json({ error: "activity is required" }, { status: 400 });

  const averageCost = await getActivityAverageCost(activity);
  return NextResponse.json({ averageCost });
}
