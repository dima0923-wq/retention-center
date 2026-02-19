import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type {
  CampaignCreateInput,
  CampaignUpdateInput,
  CampaignFilters,
  CampaignListResponse,
  CampaignStats,
} from "@/types";
import { ChannelRouterService } from "./channel/channel-router.service";

function parseCampaign<T extends { channels: string }>(campaign: T): T & { channels: string[] } {
  return {
    ...campaign,
    channels: typeof campaign.channels === "string" ? JSON.parse(campaign.channels) : campaign.channels,
  };
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["PAUSED", "COMPLETED"],
  PAUSED: ["ACTIVE", "COMPLETED"],
  COMPLETED: [],
};

export class CampaignService {
  static async create(data: CampaignCreateInput) {
    const meta: Record<string, unknown> = {};
    if (data.instantlySync) meta.instantlySync = true;
    if (data.emailSequence?.length) meta.emailSequence = data.emailSequence;
    // Schedule & rate limiting config
    if (data.contactHoursStart) meta.contactHoursStart = data.contactHoursStart;
    if (data.contactHoursEnd) meta.contactHoursEnd = data.contactHoursEnd;
    if (data.contactDays?.length) meta.contactDays = data.contactDays;
    if (data.maxContactsPerDay) meta.maxContactsPerDay = data.maxContactsPerDay;
    if (data.delayBetweenChannels) meta.delayBetweenChannels = data.delayBetweenChannels;
    if (data.autoAssign) meta.autoAssign = data.autoAssign;
    // VAPI campaign-level overrides
    if (data.vapiConfig && Object.keys(data.vapiConfig).length > 0) meta.vapiConfig = data.vapiConfig;

    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description,
        channels: JSON.stringify(data.channels),
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        meta: Object.keys(meta).length > 0 ? JSON.stringify(meta) : undefined,
      },
      include: { _count: { select: { campaignLeads: true } } },
    });
    return parseCampaign(campaign);
  }

  static async list(
    filters: CampaignFilters & {
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }
  ): Promise<CampaignListResponse> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const sortBy = filters.sortBy ?? "createdAt";
    const sortOrder = filters.sortOrder ?? "desc";

    const where: Prisma.CampaignWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search} },
        { description: { contains: filters.search} },
      ];
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const [data, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { campaignLeads: true } } },
      }),
      prisma.campaign.count({ where }),
    ]);

    return {
      data: data.map(parseCampaign),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getById(id: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        campaignLeads: {
          include: { lead: true },
          orderBy: { assignedAt: "desc" },
        },
        scripts: true,
        _count: { select: { campaignLeads: true } },
      },
    });
    if (!campaign) return null;
    const parsed = parseCampaign(campaign);
    const meta = campaign.meta ? JSON.parse(campaign.meta as string) : {};
    return {
      ...parsed,
      instantlySync: meta.instantlySync ?? false,
      emailSequence: meta.emailSequence ?? [],
      contactHoursStart: meta.contactHoursStart ?? "",
      contactHoursEnd: meta.contactHoursEnd ?? "",
      contactDays: meta.contactDays ?? [],
      maxContactsPerDay: meta.maxContactsPerDay ?? undefined,
      delayBetweenChannels: meta.delayBetweenChannels ?? undefined,
      autoAssign: meta.autoAssign ?? undefined,
      vapiConfig: meta.vapiConfig ?? undefined,
    };
  }

  static async update(id: string, data: CampaignUpdateInput) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return null;

    // Validate status transition if status is being changed
    if (data.status && data.status !== campaign.status) {
      const allowed = VALID_TRANSITIONS[campaign.status] ?? [];
      if (!allowed.includes(data.status)) {
        throw new Error(
          `Invalid status transition: ${campaign.status} -> ${data.status}`
        );
      }
    }

    // Merge meta fields
    let metaJson: string | undefined;
    const scheduleFields = ["contactHoursStart", "contactHoursEnd", "contactDays", "maxContactsPerDay", "delayBetweenChannels"] as const;
    const hasMetaUpdates = data.instantlySync !== undefined || data.emailSequence !== undefined ||
      data.autoAssign !== undefined ||
      data.vapiConfig !== undefined ||
      scheduleFields.some((f) => data[f] !== undefined);
    if (hasMetaUpdates) {
      const existingMeta = campaign.meta ? JSON.parse(campaign.meta as string) : {};
      if (data.instantlySync !== undefined) existingMeta.instantlySync = data.instantlySync;
      if (data.emailSequence !== undefined) existingMeta.emailSequence = data.emailSequence;
      for (const f of scheduleFields) {
        if (data[f] !== undefined) existingMeta[f] = data[f];
      }
      if (data.autoAssign !== undefined) existingMeta.autoAssign = data.autoAssign;
      if (data.vapiConfig !== undefined) existingMeta.vapiConfig = data.vapiConfig;
      metaJson = JSON.stringify(existingMeta);
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        channels: data.channels ? JSON.stringify(data.channels) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        status: data.status,
        ...(metaJson !== undefined && { meta: metaJson }),
      },
      include: { _count: { select: { campaignLeads: true } } },
    });
    return parseCampaign(updated);
  }

  static async delete(id: string) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return null;
    if (campaign.status !== "DRAFT") {
      throw new Error("Only draft campaigns can be deleted");
    }
    return prisma.campaign.delete({ where: { id } });
  }

  static async assignLeads(campaignId: string, leadIds: string[]) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new Error("Campaign not found");

    // Filter out already assigned leads
    const existing = await prisma.campaignLead.findMany({
      where: { campaignId, leadId: { in: leadIds } },
      select: { leadId: true },
    });
    const existingIds = new Set(existing.map((e) => e.leadId));
    const newLeadIds = leadIds.filter((id) => !existingIds.has(id));

    if (newLeadIds.length === 0) {
      return { assigned: 0, alreadyAssigned: leadIds.length };
    }

    await prisma.campaignLead.createMany({
      data: newLeadIds.map((leadId) => ({ campaignId, leadId })),
    });

    return {
      assigned: newLeadIds.length,
      alreadyAssigned: existingIds.size,
    };
  }

  static async removeLeads(campaignId: string, leadIds: string[]) {
    const result = await prisma.campaignLead.deleteMany({
      where: { campaignId, leadId: { in: leadIds } },
    });
    return { removed: result.count };
  }

  static async listLeads(
    campaignId: string,
    page = 1,
    pageSize = 20
  ) {
    const [data, total] = await Promise.all([
      prisma.campaignLead.findMany({
        where: { campaignId },
        include: { lead: true },
        orderBy: { assignedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.campaignLead.count({ where: { campaignId } }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async start(id: string) {
    const campaign = await this.update(id, { status: "ACTIVE" });
    if (!campaign) return null;

    // Queue leads for contact via channel-router (fire-and-forget)
    ChannelRouterService.queueCampaignLeads(id).catch((err) => {
      console.error(`Failed to queue leads for campaign ${id}:`, err);
    });

    return campaign;
  }

  static async pause(id: string) {
    const campaign = await this.update(id, { status: "PAUSED" });
    if (!campaign) return null;

    // Cancel pending contact attempts
    ChannelRouterService.cancelPendingAttempts(id).catch((err) => {
      console.error(`Failed to cancel pending attempts for campaign ${id}:`, err);
    });

    return campaign;
  }

  static async syncToInstantly(campaignId: string): Promise<{ instantlyCampaignId: string } | { error: string }> {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return { error: "Campaign not found" };

    const config = await prisma.integrationConfig.findUnique({ where: { provider: "instantly" } });
    if (!config || !config.isActive) return { error: "Instantly integration not configured or inactive" };
    const { apiKey } = JSON.parse(config.config) as { apiKey: string };

    const res = await fetch("https://api.instantly.ai/api/v2/campaigns", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: campaign.name }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    const data = (await res.json()) as { id: string };
    const existingMeta = campaign.meta ? JSON.parse(campaign.meta as string) : {};
    existingMeta.instantlyCampaignId = data.id;
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { meta: JSON.stringify(existingMeta) },
    });

    return { instantlyCampaignId: data.id };
  }

  static async pushLeadsToInstantly(campaignId: string): Promise<{ pushed: number } | { error: string }> {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return { error: "Campaign not found" };

    const meta = campaign.meta ? JSON.parse(campaign.meta as string) : {};
    if (!meta.instantlyCampaignId) return { error: "Campaign not synced to Instantly yet" };

    const config = await prisma.integrationConfig.findUnique({ where: { provider: "instantly" } });
    if (!config || !config.isActive) return { error: "Instantly integration not configured or inactive" };
    const { apiKey } = JSON.parse(config.config) as { apiKey: string };

    const campaignLeads = await prisma.campaignLead.findMany({
      where: { campaignId },
      include: { lead: true },
    });

    const leads = campaignLeads
      .filter((cl) => cl.lead.email)
      .map((cl) => ({
        email: cl.lead.email!,
        first_name: cl.lead.firstName,
        last_name: cl.lead.lastName,
        phone: cl.lead.phone ?? undefined,
      }));

    if (leads.length === 0) return { pushed: 0 };

    const res = await fetch("https://api.instantly.ai/api/v2/leads", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: meta.instantlyCampaignId,
        leads,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return { pushed: leads.length };
  }

  static async pullInstantlyStats(campaignId: string): Promise<{ stats: Record<string, number> } | { error: string }> {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return { error: "Campaign not found" };

    const meta = campaign.meta ? JSON.parse(campaign.meta as string) : {};
    if (!meta.instantlyCampaignId) return { error: "Campaign not synced to Instantly yet" };

    const config = await prisma.integrationConfig.findUnique({ where: { provider: "instantly" } });
    if (!config || !config.isActive) return { error: "Instantly integration not configured or inactive" };
    const { apiKey } = JSON.parse(config.config) as { apiKey: string };

    const res = await fetch(
      `https://api.instantly.ai/api/v2/campaigns/${meta.instantlyCampaignId}/analytics`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    const stats = (await res.json()) as Record<string, number>;
    return { stats };
  }

  static async getStats(id: string): Promise<CampaignStats & { attempts?: Record<string, unknown> }> {
    const [totalLeads, byStatusRaw, attemptsByStatus, attemptsByChannel] = await Promise.all([
      prisma.campaignLead.count({ where: { campaignId: id } }),
      prisma.campaignLead.groupBy({
        by: ["status"],
        where: { campaignId: id },
        _count: true,
      }),
      prisma.contactAttempt.groupBy({
        by: ["status"],
        where: { campaignId: id },
        _count: true,
      }),
      prisma.contactAttempt.groupBy({
        by: ["channel"],
        where: { campaignId: id },
        _count: true,
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) {
      byStatus[row.status] = row._count;
    }

    const attemptStatus: Record<string, number> = {};
    for (const row of attemptsByStatus) {
      attemptStatus[row.status] = row._count;
    }

    const channelBreakdown: Record<string, number> = {};
    for (const row of attemptsByChannel) {
      channelBreakdown[row.channel] = row._count;
    }

    const completed = byStatus["COMPLETED"] ?? 0;
    const conversionRate = totalLeads > 0 ? (completed / totalLeads) * 100 : 0;

    return {
      totalLeads,
      byStatus,
      conversionRate,
      attempts: {
        byStatus: attemptStatus,
        byChannel: channelBreakdown,
        total: Object.values(attemptStatus).reduce((a, b) => a + b, 0),
      },
    };
  }
}
