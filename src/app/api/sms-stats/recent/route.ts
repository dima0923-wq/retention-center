import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, 'retention:analytics:view');

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const skip = (page - 1) * limit;

    const where = { channel: "SMS" as const };

    const [attempts, total] = await Promise.all([
      prisma.contactAttempt.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
        include: {
          lead: { select: { firstName: true, lastName: true, phone: true } },
          campaign: { select: { name: true } },
        },
      }),
      prisma.contactAttempt.count({ where }),
    ]);

    const data = attempts.map((a) => ({
      id: a.id,
      leadName: `${a.lead.firstName} ${a.lead.lastName}`.trim(),
      phone: a.lead.phone,
      campaign: a.campaign?.name ?? null,
      status: a.status,
      date: a.startedAt,
      cost: a.cost,
      result: a.result,
    }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch recent SMS:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent SMS" },
      { status: 500 }
    );
  }
}
