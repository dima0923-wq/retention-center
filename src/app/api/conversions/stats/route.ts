import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const from = url.searchParams.get("from") || undefined;
    const to = url.searchParams.get("to") || undefined;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const dateFilter =
      from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
            },
          }
        : {};

    const [total, today, thisWeek, byStatus, byChannel, revenueAgg] =
      await Promise.all([
        prisma.conversion.count({ where: dateFilter }),
        prisma.conversion.count({
          where: { ...dateFilter, createdAt: { gte: todayStart } },
        }),
        prisma.conversion.count({
          where: { ...dateFilter, createdAt: { gte: weekStart } },
        }),
        prisma.conversion.groupBy({
          by: ["status"],
          _count: true,
          _sum: { revenue: true },
          where: dateFilter,
        }),
        prisma.conversion.groupBy({
          by: ["channel"],
          _count: true,
          _sum: { revenue: true },
          where: dateFilter,
        }),
        prisma.conversion.aggregate({
          _sum: { revenue: true },
          _avg: { revenue: true },
          where: dateFilter,
        }),
      ]);

    const totalRevenue = revenueAgg._sum.revenue ?? 0;
    const sales = byStatus.find((s) => s.status === "sale")?._count ?? 0;
    const conversionRate = total > 0 ? Math.round((sales / total) * 1000) / 10 : 0;
    const avgRevenue = sales > 0 ? Math.round((totalRevenue / sales) * 100) / 100 : 0;

    return NextResponse.json({
      total,
      today,
      thisWeek,
      totalRevenue,
      conversionRate,
      avgRevenue,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
        revenue: s._sum.revenue ?? 0,
      })),
      byChannel: byChannel.map((c) => ({
        channel: c.channel ?? "unknown",
        count: c._count,
        revenue: c._sum.revenue ?? 0,
      })),
    });
  } catch (error) {
    console.error("Conversion stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
