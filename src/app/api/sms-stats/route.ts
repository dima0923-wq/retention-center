import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, 'retention:analytics:view');

    const where = { channel: "SMS" as const };

    const [totalSent, delivered, failed, pending, allWithCost] = await Promise.all([
      prisma.contactAttempt.count({ where }),
      prisma.contactAttempt.count({ where: { ...where, status: "SUCCESS" } }),
      prisma.contactAttempt.count({ where: { ...where, status: "FAILED" } }),
      prisma.contactAttempt.count({ where: { ...where, status: "PENDING" } }),
      prisma.contactAttempt.findMany({
        where: { ...where, cost: { not: null } },
        select: { cost: true },
      }),
    ]);

    const totalCost = allWithCost.reduce((sum, c) => sum + (c.cost ?? 0), 0);
    const avgCost = allWithCost.length > 0 ? totalCost / allWithCost.length : 0;
    const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0;

    // SMS by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSms = await prisma.contactAttempt.findMany({
      where: { ...where, startedAt: { gte: thirtyDaysAgo } },
      select: { startedAt: true, status: true },
    });

    const byDayMap = new Map<string, number>();
    const timelineMap = new Map<string, { sent: number; delivered: number; failed: number }>();
    for (const sms of recentSms) {
      const day = sms.startedAt.toISOString().split("T")[0];
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
      const t = timelineMap.get(day) ?? { sent: 0, delivered: 0, failed: 0 };
      t.sent++;
      if (sms.status === "SUCCESS") t.delivered++;
      if (sms.status === "FAILED") t.failed++;
      timelineMap.set(day, t);
    }

    const smsByDay = Array.from(byDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const timeline = Array.from(timelineMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // SMS by status
    const allSms = await prisma.contactAttempt.findMany({
      where,
      select: { status: true },
    });
    const statusMap = new Map<string, number>();
    for (const sms of allSms) {
      statusMap.set(sms.status, (statusMap.get(sms.status) ?? 0) + 1);
    }
    const smsByStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }));

    // SMS by campaign (top 10)
    const smsWithCampaign = await prisma.contactAttempt.findMany({
      where: { ...where, campaignId: { not: null } },
      select: { campaignId: true },
    });
    const campaignCountMap = new Map<string, number>();
    for (const sms of smsWithCampaign) {
      if (sms.campaignId) {
        campaignCountMap.set(sms.campaignId, (campaignCountMap.get(sms.campaignId) ?? 0) + 1);
      }
    }
    const topCampaignIds = Array.from(campaignCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    let smsByCampaign: { campaignId: string; campaignName: string; count: number }[] = [];
    if (topCampaignIds.length > 0) {
      const campaigns = await prisma.campaign.findMany({
        where: { id: { in: topCampaignIds.map(([id]) => id) } },
        select: { id: true, name: true },
      });
      const nameMap = new Map(campaigns.map(c => [c.id, c.name]));
      smsByCampaign = topCampaignIds.map(([id, count]) => ({
        campaignId: id,
        campaignName: nameMap.get(id) ?? "Unknown",
        count,
      }));
    }

    return NextResponse.json({
      totalSent,
      delivered,
      failed,
      pending,
      deliveryRate,
      avgCost,
      totalCost,
      smsByDay,
      smsByStatus,
      smsByCampaign,
      timeline,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch SMS stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch SMS stats" },
      { status: 500 }
    );
  }
}
