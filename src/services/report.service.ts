import { prisma } from "@/lib/db";

type DateRange = {
  from?: Date;
  to?: Date;
};

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

  const [totalLeads, leadsByStatus, activeCampaigns, totalAttempts, successfulAttempts] =
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
    ]);

  const byStatus: Record<string, number> = {};
  for (const row of leadsByStatus) {
    byStatus[row.status] = row._count;
  }

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
  };

  setCache(cacheKey, result);
  return result;
}

export async function getChannelPerformance(range: DateRange) {
  const cacheKey = `channels:${range.from?.toISOString()}:${range.to?.toISOString()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const startedAtFilter = dateFilter(range);

  const channelStats = await prisma.contactAttempt.groupBy({
    by: ["channel", "status"],
    _count: true,
    _avg: { duration: true, cost: true },
    where: startedAtFilter ? { startedAt: startedAtFilter } : undefined,
  });

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

  for (const row of channelStats) {
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
    if (row._avg.duration !== null) {
      channels[row.channel].avgDuration = row._avg.duration;
    }
    if (row._avg.cost !== null) {
      channels[row.channel].avgCost = Number(row._avg.cost);
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

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: { in: ["ACTIVE", "COMPLETED"] },
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
      channels: typeof c.channels === "string" ? JSON.parse(c.channels) : c.channels,
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

  // Get leads per day
  const leads = await prisma.lead.groupBy({
    by: ["createdAt"],
    _count: true,
    where: { createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "asc" },
  });

  // Get attempts per day
  const attempts = await prisma.contactAttempt.groupBy({
    by: ["startedAt"],
    _count: true,
    where: { startedAt: { gte: from, lte: to } },
    orderBy: { startedAt: "asc" },
  });

  // Aggregate by date
  const dateMap = new Map<
    string,
    { date: string; leads: number; attempts: number; conversions: number }
  >();

  const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  for (let i = 0; i <= days; i++) {
    const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dateMap.set(key, { date: key, leads: 0, attempts: 0, conversions: 0 });
  }

  for (const row of leads) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const entry = dateMap.get(key);
    if (entry) entry.leads += row._count;
  }

  for (const row of attempts) {
    const key = row.startedAt.toISOString().slice(0, 10);
    const entry = dateMap.get(key);
    if (entry) entry.attempts += row._count;
  }

  const result = Array.from(dateMap.values());
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
