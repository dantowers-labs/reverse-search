import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { captureSharedConnections } from "@/lib/pipelines/captureSharedConnections";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/companies/[id]/people/[personId]/shared-connections">,
) {
  const { personId } = await ctx.params;
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const connections = await captureSharedConnections(Number(personId), file.name, buffer);
    return NextResponse.json({ connections });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 400 },
    );
  }
}

// Clears a mis-attributed or bad shared-connections capture so it can be
// re-added to the right person — does not touch the person's other fields.
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/companies/[id]/people/[personId]/shared-connections">,
) {
  const { id, personId } = await ctx.params;

  const person = await prisma.personProfile.findUnique({ where: { id: Number(personId) } });
  if (!person || person.companyId !== Number(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.personProfile.update({
    where: { id: person.id },
    data: { sharedConnectionsJson: null, sharedConnectionsImage: null },
  });

  return NextResponse.json({ ok: true });
}
