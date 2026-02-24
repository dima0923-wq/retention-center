import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, 'retention:analytics:view');

    const where = { channel: "CALL" as const };

    const [allCalls, successCalls, allWithDuration, allWithCost] = await Promise.all([
      prisma.contactAttempt.count({ where }),
      prisma.contactAttempt.count({ where: { ...where, status: "SUCCESS" } }),
      prisma.contactAttempt.findMany({
        where: { ...where, duration: { not: null } },
        select: { duration: true },
      }),
      prisma.contactAttempt.findMany({
        where: { ...where, cost: { not: null } },
        select: { cost: true },
      }),
    ]);

    const totalDuration = allWithDuration.reduce((sum, c) => sum + (c.duration ?? 0), 0);
    const avgDuration = allWithDuration.length > 0
      ? Math.round(totalDuration / allWithDuration.length)
      : 0;
    const totalCost = allWithCost.reduce((sum, c) => sum + (c.cost ?? 0), 0);
    const successRate = allCalls > 0 ? (successCalls / allCalls) * 100 : 0;

    return NextResponse.json({
      totalCalls: allCalls,
      successCalls,
      avgDuration,
      totalCost,
      successRate,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch call stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch call stats" },
      { status: 500 }
    );
  }
}
