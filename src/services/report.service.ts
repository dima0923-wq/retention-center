import { prisma } from "@/lib/db";

type DateRange = {
  from?: Date;
  to?: Date;
};

function safeParseArray(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function dateFilter(range: DateRange) {
  const filter: Record<string, Date> = {};
  if (range.from) filter.gte = range.from;
  if (range.to) filter.lte = range.to;
  return Object.keys(filter).length > 0 ? filter : undefined;
}

// Simple in-memory cache with TTL
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL = 60_000; // 1 minute

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

export async function getOverviewStats(range: DateRange) {
  const cacheKey = `overview:${range.from?.toISOString()}:${range.to?.toISOString()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const createdAtFilter = dateFilter(range);
  const startedAtFilter = dateFilter(range);

  const [totalLeads, leadsByStatus, activeCampaigns, totalAttempts, successfulAttempts, totalConversions, conversionRevenue] =
    await Promise.all([
      prisma.lead.count({
        where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
      }),
      prisma.lead.groupBy({
        by: ["status"],
        _count: true,
        where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
      }),
      prisma.campaign.count({ where: { status: "ACTIVE" } }),
      prisma.contactAttempt.count({
        where: startedAtFilter ? { startedAt: startedAtFilter } : undefined,
      }),
      prisma.contactAttempt.count({
        where: {
          status: "SUCCESS",
          ...(startedAtFilter ? { startedAt: startedAtFilter } : {}),
        },
      }),
      prisma.conversion.count({
        where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
      }),
      prisma.conversion.aggregate({
        _sum: { revenue: true },
        where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
      }),
    ]);

  const byStatus: Record<string, number> = {};
  for (const row of leadsByStatus) {
    byStatus[row.status] = row._count;
  }

  // Note: conversionRate is lead-status-based (CONVERTED leads / total leads), not attempt-to-conversion
  const conversionRate =
    totalLeads > 0 ? ((byStatus["CONVERTED"] ?? 0) / totalLeads) * 100 : 0;

  const successRate =
    totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

  const result = {
    totalLeads,
    leadsByStatus: byStatus,
    activeCampaigns,
    totalAttempts,
    successfulAttempts,
    conversionRate: Math.round(conversionRate * 10) / 10,
    successRate: Math.round(successRate * 10) / 10,
    totalConversions,
    totalRevenue: conversionRevenue._sum.revenue ?? 0,
  };

  setCache(cacheKey, result);
  return result;
}

export async function getChannelPerformance(range: DateRange) {
  const cacheKey = `channels:${range.from?.toISOString()}:${range.to?.toISOString()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const startedAtFilter = dateFilter(range);
  const where = startedAtFilter ? { startedAt: startedAtFilter } : undefined;

  const [channelStatusStats, channelAvgStats] = await Promise.all([
    prisma.contactAttempt.groupBy({
      by: ["channel", "status"],
      _count: true,
      where,
    }),
    prisma.contactAttempt.groupBy({
      by: ["channel"],
      _avg: { duration: true, cost: true },
      where,
    }),
  ]);

  const channels: Record<
    string,
    {
      channel: string;
      total: number;
      successful: number;
      successRate: number;
      avgDuration: number | null;
      avgCost: number | null;
    }
  > = {};

  for (const row of channelStatusStats) {
    if (!channels[row.channel]) {
      channels[row.channel] = {
        channel: row.channel,
        total: 0,
        successful: 0,
        successRate: 0,
        avgDuration: null,
        avgCost: null,
      };
    }
    channels[row.channel].total += row._count;
    if (row.status === "SUCCESS") {
      channels[row.channel].successful += row._count;
    }
  }

  for (const row of channelAvgStats) {
    if (channels[row.channel]) {
      channels[row.channel].avgDuration = row._avg.duration ?? null;
      channels[row.channel].avgCost = row._avg.cost !== null ? Number(row._avg.cost) : null;
    }
  }

  const result = Object.values(channels).map((ch) => ({
    ...ch,
    successRate:
      ch.total > 0 ? Math.round((ch.successful / ch.total) * 1000) / 10 : 0,
  }));

  setCache(cacheKey, result);
  return result;
}

export async function getCampaignComparison(range: DateRange) {
  const cacheKey = `campaigns:${range.from?.toISOString()}:${range.to?.toISOString()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const createdAtFilter = dateFilter(range);
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: { in: ["ACTIVE", "COMPLETED"] },
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    },
    include: {
      _count: { select: { campaignLeads: true } },
      campaignLeads: {
        select: { status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = campaigns.map((c) => {
    const totalLeads = c._count.campaignLeads;
    const completed = c.campaignLeads.filter(
      (cl) => cl.status === "COMPLETED"
    ).length;
    const conversionRate =
      totalLeads > 0 ? Math.round((completed / totalLeads) * 1000) / 10 : 0;

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      channels: safeParseArray(c.channels),
      totalLeads,
      completed,
      conversionRate,
    };
  });

  setCache(cacheKey, result);
  return result;
}

export async function getTimeline(range: DateRange) {
  const cacheKey = `timeline:${range.from?.toISOString()}:${range.to?.toISOString()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const from = range.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = range.to ?? new Date();

  // Use raw SQL to aggregate counts by date at the DB level instead of loading all records
  const [leadCounts, attemptCounts, conversionCounts] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ d: string; c: bigint }>>(
      `SELECT DATE(createdAt) as d, COUNT(*) as c FROM Lead WHERE createdAt >= ? AND createdAt <= ? GROUP BY DATE(createdAt)`,
      from.toISOString(),
      to.toISOString()
    ),
    prisma.$queryRawUnsafe<Array<{ d: string; c: bigint }>>(
      `SELECT DATE(startedAt) as d, COUNT(*) as c FROM ContactAttempt WHERE startedAt >= ? AND startedAt <= ? GROUP BY DATE(startedAt)`,
      from.toISOString(),
      to.toISOString()
    ),
    prisma.$queryRawUnsafe<Array<{ d: string; c: bigint }>>(
      `SELECT DATE(createdAt) as d, COUNT(*) as c FROM Conversion WHERE createdAt >= ? AND createdAt <= ? GROUP BY DATE(createdAt)`,
      from.toISOString(),
      to.toISOString()
    ),
  ]);

  // Build date map with all days in range
  const dateMap = new Map<
    string,
    { date: string; leads: number; attempts: number; conversions: number }
  >();

  const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dateMap.set(key, { date: key, leads: 0, attempts: 0, conversions: 0 });
  }

  for (const row of leadCounts) {
    const entry = dateMap.get(row.d);
    if (entry) entry.leads = Number(row.c);
  }

  for (const row of attemptCounts) {
    const entry = dateMap.get(row.d);
    if (entry) entry.attempts = Number(row.c);
  }

  for (const row of conversionCounts) {
    const entry = dateMap.get(row.d);
    if (entry) entry.conversions = Number(row.c);
  }

  const result = Array.from(dateMap.values());
  setCache(cacheKey, result);
  return result;
}

export async function getEmailAnalytics(range: DateRange) {
  const cacheKey = `email-analytics:${range.from?.toISOString()}:${range.to?.toISOString()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const startedAtFilter = dateFilter(range);
  const emailWhere = {
    channel: "EMAIL",
    ...(startedAtFilter ? { startedAt: startedAtFilter } : {}),
  };

  const from = range.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = range.to ?? new Date();

  // Process email attempts in batches using cursor-based pagination to avoid OOM
  const BATCH_SIZE = 1000;
  let totalSent = 0;
  let opened = 0;
  let clicked = 0;
  let replied = 0;
  let bounced = 0;

  // Timeline: group by date
  const dateMap = new Map<string, { date: string; sent: number; opened: number; clicked: number; replied: number }>();
  const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dateMap.set(key, { date: key, sent: 0, opened: 0, clicked: 0, replied: 0 });
  }

  // Top campaigns by email attempts
  const campaignMap = new Map<string, { id: string; sent: number; opened: number; clicked: number; replied: number }>();
  // Account health by provider
  const providerMap = new Map<string, { total: number; successful: number }>();

  // Helper to parse result and extract email metrics from a single attempt
  function parseEmailMetrics(a: { status: string; result: string | null }) {
    const m = { opened: false, clicked: false, replied: false, bounced: false };
    if (!a.result) return m;
    try {
      const r = JSON.parse(a.result);
      if (r.opened) m.opened = true;
      if (r.clicked) m.clicked = true;
      if (r.replied) m.replied = true;
      if (r.bounced) m.bounced = true;
    } catch {
      if (a.status === "BOUNCED" || a.result === "BOUNCED") m.bounced = true;
      if (a.status === "SUCCESS" && a.result === "OPENED") m.opened = true;
      if (a.result === "REPLIED") { m.replied = true; m.opened = true; }
      if (a.result === "CLICKED") { m.clicked = true; m.opened = true; }
    }
    return m;
  }

  let cursor: string | undefined;
  while (true) {
    const batch = await prisma.contactAttempt.findMany({
      where: emailWhere,
      select: {
        id: true,
        status: true,
        result: true,
        startedAt: true,
        campaignId: true,
        provider: true,
      },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    for (const a of batch) {
      totalSent++;
      const m = parseEmailMetrics(a);
      if (m.opened) opened++;
      if (m.clicked) clicked++;
      if (m.replied) replied++;
      if (m.bounced) bounced++;

      // Timeline
      const key = a.startedAt.toISOString().slice(0, 10);
      const entry = dateMap.get(key);
      if (entry) {
        entry.sent++;
        if (m.opened) entry.opened++;
        if (m.clicked) entry.clicked++;
        if (m.replied) entry.replied++;
      }

      // Campaign stats
      if (a.campaignId) {
        if (!campaignMap.has(a.campaignId)) {
          campaignMap.set(a.campaignId, { id: a.campaignId, sent: 0, opened: 0, clicked: 0, replied: 0 });
        }
        const c = campaignMap.get(a.campaignId)!;
        c.sent++;
        if (m.opened) c.opened++;
        if (m.clicked) c.clicked++;
        if (m.replied) c.replied++;
      }

      // Provider stats
      const prov = a.provider ?? "Unknown";
      if (!providerMap.has(prov)) {
        providerMap.set(prov, { total: 0, successful: 0 });
      }
      const p = providerMap.get(prov)!;
      p.total++;
      if (a.status === "SUCCESS") p.successful++;
    }

    if (batch.length < BATCH_SIZE) break;
  }

  const openRate = totalSent > 0 ? Math.round((opened / totalSent) * 1000) / 10 : 0;
  const clickRate = totalSent > 0 ? Math.round((clicked / totalSent) * 1000) / 10 : 0;
  const replyRate = totalSent > 0 ? Math.round((replied / totalSent) * 1000) / 10 : 0;
  const bounceRate = totalSent > 0 ? Math.round((bounced / totalSent) * 1000) / 10 : 0;

  // Fetch campaign names
  const campaignIds = Array.from(campaignMap.keys());
  const campaignRecords = campaignIds.length > 0
    ? await prisma.campaign.findMany({
        where: { id: { in: campaignIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameMap = new Map(campaignRecords.map((c) => [c.id, c.name]));

  const topCampaigns = Array.from(campaignMap.values())
    .map((c) => ({
      id: c.id,
      name: nameMap.get(c.id) ?? "Unknown",
      sent: c.sent,
      openRate: c.sent > 0 ? Math.round((c.opened / c.sent) * 1000) / 10 : 0,
      clickRate: c.sent > 0 ? Math.round((c.clicked / c.sent) * 1000) / 10 : 0,
      replyRate: c.sent > 0 ? Math.round((c.replied / c.sent) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sent - a.sent)
    .slice(0, 10);

  const accountHealth = Array.from(providerMap.entries()).map(([provider, stats]) => ({
    provider,
    status: stats.total === 0 ? "No Data" : stats.successful / stats.total >= 0.9 ? "Healthy" : stats.successful / stats.total >= 0.7 ? "Warning" : "Critical",
    successRate: stats.total > 0 ? Math.round((stats.successful / stats.total) * 1000) / 10 : 0,
  }));

  const result = {
    totalSent,
    openRate,
    clickRate,
    replyRate,
    bounceRate,
    timeline: Array.from(dateMap.values()),
    topCampaigns,
    accountHealth,
  };

  setCache(cacheKey, result);
  return result;
}

export async function getLeadFunnel(range: DateRange) {
  const cacheKey = `funnel:${range.from?.toISOString()}:${range.to?.toISOString()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const createdAtFilter = dateFilter(range);

  const statusCounts = await prisma.lead.groupBy({
    by: ["status"],
    _count: true,
    where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
  });

  const funnelOrder = ["NEW", "CONTACTED", "IN_PROGRESS", "CONVERTED"] as const;
  const result = funnelOrder.map((status) => ({
    status,
    count: statusCounts.find((s) => s.status === status)?._count ?? 0,
  }));

  setCache(cacheKey, result);
  return result;
}
