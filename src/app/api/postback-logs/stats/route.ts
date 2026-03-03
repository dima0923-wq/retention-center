import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:analytics:view');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalToday, successToday, failedToday, retryToday, byDestination, byStatus] =
      await Promise.all([
        prisma.postbackLog.count({
          where: { createdAt: { gte: todayStart } },
        }),
        prisma.postbackLog.count({
          where: { status: "success", createdAt: { gte: todayStart } },
        }),
        prisma.postbackLog.count({
          where: { status: "failed", createdAt: { gte: todayStart } },
        }),
        prisma.postbackLog.count({
          where: { status: "retry", createdAt: { gte: todayStart } },
        }),
        prisma.postbackLog.groupBy({
          by: ["destination"],
          _count: true,
          where: { createdAt: { gte: todayStart } },
        }),
        prisma.postbackLog.groupBy({
          by: ["status"],
          _count: true,
        }),
      ]);

    return NextResponse.json({
      today: {
        total: totalToday,
        success: successToday,
        failed: failedToday,
        retry: retryToday,
      },
      byDestination: byDestination.map((d) => ({
        destination: d.destination,
        count: d._count,
      })),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Postback logs stats error:", error);
    return NextResponse.json({ error: "Failed to fetch postback log stats" }, { status: 500 });
  }
}
