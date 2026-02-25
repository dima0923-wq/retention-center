import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:analytics:view");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.keitaroCampaignMapping.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.keitaroCampaignMapping.update({
    where: { id },
    data: {
      campaignId: "campaignId" in body ? (body.campaignId ?? null) : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    },
    include: { campaign: { select: { id: true, name: true, status: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:analytics:view");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const { id } = await params;
  const existing = await prisma.keitaroCampaignMapping.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.keitaroCampaignMapping.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
