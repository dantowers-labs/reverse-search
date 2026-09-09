import { NextResponse } from "next/server";
import { generateInterviewGuide } from "@/lib/pipelines/generateInterviewGuide";

export async function POST(request: Request, ctx: RouteContext<"/api/interview-rounds/[id]/guide">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { includeCrossOpportunityContext?: boolean };

  try {
    const round = await generateInterviewGuide(Number(id), body.includeCrossOpportunityContext ?? true);
    return NextResponse.json({ round });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Guide generation failed" },
      { status: 400 },
    );
  }
}
