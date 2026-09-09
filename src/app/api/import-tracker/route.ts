import { NextResponse } from "next/server";
import { commitTrackerImport, type TrackerFieldTarget } from "@/lib/importTracker";

// Step 2 of the mapping wizard — commits using a user-confirmed mapping.
export async function POST(request: Request) {
  const body = (await request.json()) as { path: string; mapping: Record<string, TrackerFieldTarget> };
  if (!body.path || !body.mapping) {
    return NextResponse.json({ error: "path and mapping are required" }, { status: 400 });
  }

  try {
    const result = await commitTrackerImport(body.path, body.mapping);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 400 },
    );
  }
}
