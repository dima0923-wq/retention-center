import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, "retention:analytics:view");

    const { searchParams } = request.nextUrl;

    const status = searchParams.get("status");
    const assistantId = searchParams.get("assistantId");
    const customerNumber = searchParams.get("customerNumber");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    const where: Record<string, unknown> = {};
    if (status && status !== "all") where.status = status;
    if (assistantId && assistantId !== "all") where.assistantId = assistantId;
    if (customerNumber) where.customerNumber = { contains: customerNumber };
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

    const [calls, total] = await Promise.all([
      prisma.vapiCall.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vapiCall.count({ where }),
    ]);

    // Fetch linked ContactAttempt lead names
    const attemptIds = calls
      .map((c) => c.contactAttemptId)
      .filter((id): id is string => !!id);

    const attempts = attemptIds.length > 0
      ? await prisma.contactAttempt.findMany({
          where: { id: { in: attemptIds } },
          include: { lead: { select: { firstName: true, lastName: true } } },
        })
      : [];

    const attemptMap = new Map(
      attempts.map((a) => [
        a.id,
        a.lead ? `${a.lead.firstName} ${a.lead.lastName}`.trim() : null,
      ])
    );

    const data = calls.map((c) => ({
      id: c.id,
      vapiCallId: c.vapiCallId,
      type: c.type,
      status: c.status,
      assistantId: c.assistantId,
      phoneNumberId: c.phoneNumberId,
      customerNumber: c.customerNumber,
      customerName: c.customerName,
      startedAt: c.startedAt?.toISOString() ?? null,
      endedAt: c.endedAt?.toISOString() ?? null,
      duration: c.duration,
      cost: c.cost,
      summary: c.summary,
      successEvaluation: c.successEvaluation,
      endedReason: c.endedReason,
      recordingUrl: c.recordingUrl,
      contactAttemptId: c.contactAttemptId,
      leadName: c.contactAttemptId ? attemptMap.get(c.contactAttemptId) ?? null : null,
      createdAt: c.createdAt.toISOString(),
    }));

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch VAPI calls:", error);
    return NextResponse.json(
      { error: "Failed to fetch VAPI calls" },
      { status: 500 }
    );
  }
}
