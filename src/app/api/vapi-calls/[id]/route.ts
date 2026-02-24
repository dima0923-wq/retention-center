import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, "retention:analytics:view");

    const { id } = await params;

    const call = await prisma.vapiCall.findUnique({
      where: { id },
      include: { logs: { orderBy: { createdAt: "asc" } } },
    });

    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Get linked lead name if available
    let leadName: string | null = null;
    if (call.contactAttemptId) {
      const attempt = await prisma.contactAttempt.findUnique({
        where: { id: call.contactAttemptId },
        include: { lead: { select: { firstName: true, lastName: true } } },
      });
      if (attempt?.lead) {
        leadName = `${attempt.lead.firstName} ${attempt.lead.lastName}`.trim();
      }
    }

    return NextResponse.json({
      ...call,
      startedAt: call.startedAt?.toISOString() ?? null,
      endedAt: call.endedAt?.toISOString() ?? null,
      createdAt: call.createdAt.toISOString(),
      updatedAt: call.updatedAt.toISOString(),
      leadName,
      logs: call.logs.map((l) => ({
        id: l.id,
        eventType: l.eventType,
        payload: l.payload,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch VAPI call:", error);
    return NextResponse.json(
      { error: "Failed to fetch VAPI call" },
      { status: 500 }
    );
  }
}
