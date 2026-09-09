import { NextResponse } from "next/server";
import { getSpendTotals } from "@/lib/usageStats";

// Powers the header's spend figure and the dashboard stat strip — kept
// deliberately tiny so it's cheap to refetch whenever a run completes,
// without pulling in the full admin breakdown logic.
export async function GET() {
  return NextResponse.json(await getSpendTotals());
}
