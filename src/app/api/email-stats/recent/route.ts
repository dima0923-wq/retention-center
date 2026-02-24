import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, requirePermission, AuthError, authErrorResponse } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, "retention:analytics:view");

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
    const skip = (page - 1) * limit;

    const [attempts, total] = await Promise.all([
      prisma.contactAttempt.findMany({
        where: { channel: "EMAIL" },
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          provider: true,
          providerRef: true,
          startedAt: true,
          completedAt: true,
          result: true,
          notes: true,
          cost: true,
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
          script: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.contactAttempt.count({ where: { channel: "EMAIL" } }),
    ]);

    const items = attempts.map((a) => ({
      id: a.id,
      status: a.status,
      provider: a.provider,
      providerRef: a.providerRef,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      result: a.result,
      notes: a.notes,
      cost: a.cost,
      leadId: a.lead.id,
      leadName: `${a.lead.firstName} ${a.lead.lastName}`,
      leadEmail: a.lead.email,
      campaignId: a.campaign?.id ?? null,
      campaignName: a.campaign?.name ?? null,
      templateName: a.script?.name ?? null,
    }));

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch recent emails:", error);
    return NextResponse.json({ error: "Failed to fetch recent emails" }, { status: 500 });
  }
}
