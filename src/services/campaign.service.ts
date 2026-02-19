import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type {
  CampaignCreateInput,
  CampaignUpdateInput,
  CampaignFilters,
  CampaignListResponse,
  CampaignStats,
} from "@/types";

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
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description,
        channels: JSON.stringify(data.channels),
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
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
    return campaign ? parseCampaign(campaign) : null;
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

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        channels: data.channels ? JSON.stringify(data.channels) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        status: data.status,
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
    return this.update(id, { status: "ACTIVE" });
  }

  static async pause(id: string) {
    return this.update(id, { status: "PAUSED" });
  }

  static async getStats(id: string): Promise<CampaignStats> {
    const [totalLeads, byStatusRaw] = await Promise.all([
      prisma.campaignLead.count({ where: { campaignId: id } }),
      prisma.campaignLead.groupBy({
        by: ["status"],
        where: { campaignId: id },
        _count: true,
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) {
      byStatus[row.status] = row._count;
    }

    const completed = byStatus["COMPLETED"] ?? 0;
    const conversionRate = totalLeads > 0 ? (completed / totalLeads) * 100 : 0;

    return { totalLeads, byStatus, conversionRate };
  }
}
