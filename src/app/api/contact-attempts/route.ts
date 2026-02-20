import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    await verifyApiAuth(request);
    const { searchParams } = request.nextUrl;
    const channel = searchParams.get("channel");
    const limitStr = searchParams.get("limit");
    const limit = limitStr ? Math.min(parseInt(limitStr, 10), 100) : 20;

    const where: Record<string, unknown> = {};
    if (channel) where.channel = channel;

    const attempts = await prisma.contactAttempt.findMany({
      where,
      include: {
        lead: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    const data = attempts.map((a) => ({
      id: a.id,
      leadName: a.lead
        ? `${a.lead.firstName} ${a.lead.lastName}`.trim()
        : "Unknown",
      channel: a.channel,
      status: a.status,
      startedAt: a.startedAt.toISOString(),
    }));

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch contact attempts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact attempts" },
      { status: 500 }
    );
  }
}
