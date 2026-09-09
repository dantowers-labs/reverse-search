import { NextResponse } from "next/server";
import { importJobPosting } from "@/lib/pipelines/importJobPosting";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    rawText: string;
    applicationStatus?: string | null;
    companyId?: number;
  };

  if (!body.rawText?.trim()) {
    return NextResponse.json({ error: "rawText is required" }, { status: 400 });
  }

  try {
    const { jobPosting, companySlug } = await importJobPosting(
      body.rawText,
      body.applicationStatus?.trim() || null,
      body.companyId,
    );
    return NextResponse.json({ jobPosting, companySlug });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 400 },
    );
  }
}
