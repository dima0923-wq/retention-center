import { prisma } from "@/lib/db";
import type {
  LeadCreateInput,
  LeadUpdateInput,
  LeadFilters,
  PaginationParams,
  LeadListResponse,
  LeadWithAttempts,
  LeadStats,
} from "@/types";
import type { Prisma } from "@/generated/prisma/client";

export class LeadService {
  static async create(input: LeadCreateInput) {
    // Deduplicate by email or phone
    if (input.email || input.phone) {
      const existing = await prisma.lead.findFirst({
        where: {
          OR: [
            ...(input.email ? [{ email: input.email }] : []),
            ...(input.phone ? [{ phone: input.phone }] : []),
          ],
        },
      });
      if (existing) {
        return { lead: existing, deduplicated: true };
      }
    }

    const lead = await prisma.lead.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
        email: input.email || null,
        source: (input.source as string) || "MANUAL",
        externalId: input.externalId || null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
        notes: input.notes || null,
      },
    });

    return { lead, deduplicated: false };
  }

  static async bulkCreate(inputs: LeadCreateInput[]) {
    const results = { created: 0, deduplicated: 0, errors: 0 };

    for (const input of inputs) {
      try {
        const result = await LeadService.create(input);
        if (result.deduplicated) {
          results.deduplicated++;
        } else {
          results.created++;
        }
      } catch {
        results.errors++;
      }
    }

    return results;
  }

  static async list(
    filters: LeadFilters,
    pagination: PaginationParams,
    sortBy = "createdAt",
    sortOrder: "asc" | "desc" = "desc"
  ): Promise<LeadListResponse> {
    const where: Prisma.LeadWhereInput = {};

    if (filters.status) {
      where.status = filters.status as string;
    }
    if (filters.source) {
      where.source = filters.source as string;
    }
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search} },
        { lastName: { contains: filters.search} },
        { email: { contains: filters.search} },
        { phone: { contains: filters.search} },
      ];
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo);
      }
    }

    const allowedSortFields = ["createdAt", "firstName", "lastName", "email", "status", "source"];
    const safeSort = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";

    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { [safeSort]: sortOrder },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    };
  }

  static async getById(id: string): Promise<LeadWithAttempts | null> {
    return prisma.lead.findUnique({
      where: { id },
      include: {
        contactAttempts: {
          orderBy: { startedAt: "desc" },
        },
        campaignLeads: {
          include: { campaign: true },
        },
      },
    }) as Promise<LeadWithAttempts | null>;
  }

  static async update(id: string, input: LeadUpdateInput) {
    if (input.status) {
      const existing = await prisma.lead.findUnique({ where: { id } });
      if (!existing) return null;

      if (existing.status === "DO_NOT_CONTACT" && input.status !== "DO_NOT_CONTACT") {
        throw new Error("Cannot change status from DO_NOT_CONTACT");
      }
    }

    return prisma.lead.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined && { firstName: input.firstName }),
        ...(input.lastName !== undefined && { lastName: input.lastName }),
        ...(input.phone !== undefined && { phone: input.phone || null }),
        ...(input.email !== undefined && { email: input.email || null }),
        ...(input.status !== undefined && { status: input.status as string }),
        ...(input.notes !== undefined && { notes: input.notes || null }),
      },
    });
  }

  static async softDelete(id: string) {
    return prisma.lead.update({
      where: { id },
      data: { status: "DO_NOT_CONTACT" },
    });
  }

  static async syncLeadToInstantly(
    leadId: string,
    campaignId: string
  ): Promise<{ ok: true } | { error: string }> {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { error: "Lead not found" };
    if (!lead.email) return { error: "Lead has no email address" };

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return { error: "Campaign not found" };

    const meta = campaign.meta ? JSON.parse(campaign.meta as string) : {};
    if (!meta.instantlyCampaignId) return { error: "Campaign not synced to Instantly yet" };

    const config = await prisma.integrationConfig.findUnique({ where: { provider: "instantly" } });
    if (!config || !config.isActive) return { error: "Instantly integration not configured or inactive" };
    const { apiKey } = JSON.parse(config.config) as { apiKey: string };

    const res = await fetch("https://api.instantly.ai/api/v2/leads", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: meta.instantlyCampaignId,
        leads: [{
          email: lead.email,
          first_name: lead.firstName,
          last_name: lead.lastName,
          phone: lead.phone ?? undefined,
        }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return { ok: true };
  }

  static async syncLeadsBulkToInstantly(
    leadIds: string[],
    campaignId: string
  ): Promise<{ synced: number } | { error: string }> {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return { error: "Campaign not found" };

    const meta = campaign.meta ? JSON.parse(campaign.meta as string) : {};
    if (!meta.instantlyCampaignId) return { error: "Campaign not synced to Instantly yet" };

    const config = await prisma.integrationConfig.findUnique({ where: { provider: "instantly" } });
    if (!config || !config.isActive) return { error: "Instantly integration not configured or inactive" };
    const { apiKey } = JSON.parse(config.config) as { apiKey: string };

    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
    });

    const leadsWithEmail = leads
      .filter((l) => l.email)
      .map((l) => ({
        email: l.email!,
        first_name: l.firstName,
        last_name: l.lastName,
        phone: l.phone ?? undefined,
      }));

    if (leadsWithEmail.length === 0) return { synced: 0 };

    const res = await fetch("https://api.instantly.ai/api/v2/leads", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: meta.instantlyCampaignId,
        leads: leadsWithEmail,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return { synced: leadsWithEmail.length };
  }

  static async getStats(): Promise<LeadStats> {
    const [total, byStatus, bySource] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.lead.groupBy({
        by: ["source"],
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      bySource: Object.fromEntries(bySource.map((s) => [s.source, s._count])),
    };
  }
}
