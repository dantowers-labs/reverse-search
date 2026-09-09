import { NextResponse } from "next/server";
import { parseTrackerCsv } from "@/lib/importTracker";

// Step 1 of the mapping wizard — parses the CSV and proposes a column
// mapping. Nothing is written; the wizard shows this for confirmation.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const path = typeof body.path === "string" && body.path.length > 0 ? body.path : "";

  try {
    const preview = parseTrackerCsv(path);
    return NextResponse.json({ path, ...preview });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read that CSV" },
      { status: 400 },
    );
  }
}
