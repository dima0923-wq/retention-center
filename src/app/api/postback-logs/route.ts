import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:analytics:view');

    const url = req.nextUrl;
    const destination = url.searchParams.get("destination") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const from = url.searchParams.get("from") || undefined;
    const to = url.searchParams.get("to") || undefined;
    const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);
    const skip = Number(url.searchParams.get("skip")) || 0;

    const where: Record<string, unknown> = {};
    if (destination) where.destination = destination;
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.postbackLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.postbackLog.count({ where }),
    ]);

    return NextResponse.json({ data: logs, total, limit, skip });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Postback logs list error:", error);
    return NextResponse.json({ error: "Failed to fetch postback logs" }, { status: 500 });
  }
}
