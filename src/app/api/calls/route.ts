import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, 'retention:contacts:view');
    const { searchParams } = request.nextUrl;

    const status = searchParams.get("status");
    const campaignId = searchParams.get("campaignId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    const where: Record<string, unknown> = { channel: "CALL" };
    if (status && status !== "all") where.status = status;
    if (campaignId && campaignId !== "all") where.campaignId = campaignId;
    if (from || to) {
      const startedAt: Record<string, Date> = {};
      if (from) startedAt.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        startedAt.lte = end;
      }
      where.startedAt = startedAt;
    }

    const [attempts, total] = await Promise.all([
      prisma.contactAttempt.findMany({
        where,
        include: {
          lead: { select: { firstName: true, lastName: true, phone: true } },
          campaign: { select: { id: true, name: true } },
        },
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.contactAttempt.count({ where }),
    ]);

    const data = attempts.map((a) => {
      let transcript = null;
      let keywords: string[] = [];
      let summary = null;
      if (a.result) {
        try {
          const parsed = JSON.parse(a.result);
          transcript = parsed.transcript ?? parsed.messages ?? null;
          keywords = parsed.keywords ?? [];
          summary = parsed.summary ?? null;
        } catch {
          // result is plain text
          transcript = a.result;
        }
      }

      return {
        id: a.id,
        leadName: a.lead
          ? `${a.lead.firstName} ${a.lead.lastName}`.trim()
          : "Unknown",
        phone: a.lead?.phone ?? null,
        campaignId: a.campaign?.id ?? null,
        campaignName: a.campaign?.name ?? null,
        status: a.status,
        provider: a.provider,
        providerRef: a.providerRef,
        startedAt: a.startedAt.toISOString(),
        completedAt: a.completedAt?.toISOString() ?? null,
        duration: a.duration,
        cost: a.cost,
        transcript,
        keywords,
        summary,
        notes: a.notes,
      };
    });

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch calls:", error);
    return NextResponse.json(
      { error: "Failed to fetch calls" },
      { status: 500 }
    );
  }
}
