import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:analytics:view");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const mappings = await prisma.keitaroCampaignMapping.findMany({
    include: { campaign: { select: { id: true, name: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(mappings);
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:analytics:view");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.keitaroCampaignId !== "string") {
    return NextResponse.json({ error: "keitaroCampaignId is required" }, { status: 400 });
  }

  const mapping = await prisma.keitaroCampaignMapping.upsert({
    where: { keitaroCampaignId: body.keitaroCampaignId },
    create: {
      keitaroCampaignId: body.keitaroCampaignId,
      keitaroCampaignName: body.keitaroCampaignName ?? null,
      campaignId: body.campaignId ?? null,
      isActive: body.isActive ?? true,
    },
    update: {
      keitaroCampaignName: body.keitaroCampaignName ?? undefined,
      campaignId: body.campaignId ?? null,
      isActive: body.isActive ?? true,
    },
    include: { campaign: { select: { id: true, name: true, status: true } } },
  });

  return NextResponse.json(mapping);
}
