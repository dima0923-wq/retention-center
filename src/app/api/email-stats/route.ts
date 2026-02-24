import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, requirePermission, AuthError, authErrorResponse } from "@/lib/api-auth";
import { PostmarkService } from "@/services/channel/postmark.service";
import { getEmailAnalytics } from "@/services/report.service";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, "retention:analytics:view");

    const from = new Date();
    from.setDate(from.getDate() - 30);
    const to = new Date();

    // 1. ContactAttempt stats for EMAIL channel
    const [statusGroups, emailsByDay, campaignGroups] = await Promise.all([
      prisma.contactAttempt.groupBy({
        by: ["status"],
        _count: true,
        where: { channel: "EMAIL", startedAt: { gte: from, lte: to } },
      }),
      prisma.contactAttempt.findMany({
        where: { channel: "EMAIL", startedAt: { gte: from, lte: to } },
        select: { startedAt: true, status: true },
      }),
      prisma.contactAttempt.groupBy({
        by: ["campaignId"],
        _count: true,
        where: { channel: "EMAIL", startedAt: { gte: from, lte: to }, campaignId: { not: null } },
        orderBy: { _count: { campaignId: "desc" } },
        take: 10,
      }),
    ]);

    // Aggregate status counts
    const emailsByStatus: Record<string, number> = {};
    let totalSent = 0;
    let delivered = 0;
    let failed = 0;
    let pending = 0;
    let bounced = 0;

    for (const row of statusGroups) {
      emailsByStatus[row.status] = row._count;
      totalSent += row._count;
      if (row.status === "SUCCESS") delivered += row._count;
      else if (row.status === "FAILED") failed += row._count;
      else if (row.status === "PENDING" || row.status === "IN_PROGRESS") pending += row._count;
      else if (row.status === "BOUNCED") bounced += row._count;
    }

    // Build emailsByDay (last 30 days)
    const dayMap = new Map<string, number>();
    const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    for (let i = 0; i < days; i++) {
      const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const a of emailsByDay) {
      const key = a.startedAt.toISOString().slice(0, 10);
      dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
    }
    const emailsByDayArray = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));

    // Resolve campaign names for top 10
    const campaignIds = campaignGroups
      .map((g) => g.campaignId)
      .filter((id): id is string => id !== null);
    const campaigns = campaignIds.length > 0
      ? await prisma.campaign.findMany({
          where: { id: { in: campaignIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameMap = new Map(campaigns.map((c) => [c.id, c.name]));
    const emailsByCampaign = campaignGroups.map((g) => ({
      campaignId: g.campaignId,
      name: nameMap.get(g.campaignId!) ?? "Unknown",
      count: g._count,
    }));

    // 2. Instantly analytics (from report.service)
    let instantlyStats = null;
    try {
      const analytics = await getEmailAnalytics({ from, to }) as {
        totalSent: number;
        openRate: number;
        clickRate: number;
        replyRate: number;
        bounceRate: number;
      };
      instantlyStats = {
        totalSent: analytics.totalSent,
        openRate: analytics.openRate,
        clickRate: analytics.clickRate,
        replyRate: analytics.replyRate,
        bounceRate: analytics.bounceRate,
      };
    } catch {
      // Instantly not available
    }

    // 3. Postmark stats (if configured)
    let postmarkStats = null;
    try {
      const overview = await PostmarkService.getOutboundStats({
        fromDate: from.toISOString().slice(0, 10),
        toDate: to.toISOString().slice(0, 10),
      });
      if (overview && !("error" in overview)) {
        postmarkStats = overview;
      }
    } catch {
      // Postmark not configured
    }

    // Derive rates from Instantly if available, otherwise from ContactAttempt data
    const openRate = instantlyStats?.openRate ?? 0;
    const clickRate = instantlyStats?.clickRate ?? 0;
    const replyRate = instantlyStats?.replyRate ?? 0;
    const bounceRate = instantlyStats?.bounceRate ??
      (totalSent > 0 ? Math.round((bounced / totalSent) * 1000) / 10 : 0);

    return NextResponse.json({
      totalSent,
      delivered,
      failed,
      bounced,
      pending,
      openRate,
      clickRate,
      replyRate,
      bounceRate,
      emailsByDay: emailsByDayArray,
      emailsByStatus,
      emailsByCampaign,
      postmarkStats,
      instantlyStats,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch email stats:", error);
    return NextResponse.json({ error: "Failed to fetch email stats" }, { status: 500 });
  }
}
