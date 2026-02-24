import { prisma } from "@/lib/db";

export class ZapierConfigService {
  static async findAll(campaignId?: string) {
    const where = campaignId ? { campaignId } : {};
    return prisma.zapierWebhookConfig.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { campaign: true, sequence: true },
    });
  }

  static async findById(id: string) {
    return prisma.zapierWebhookConfig.findUnique({
      where: { id },
      include: { campaign: true, sequence: true },
    });
  }

  static async findByCampaignId(campaignId: string) {
    return prisma.zapierWebhookConfig.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
      include: { campaign: true, sequence: true },
    });
  }

  static async findByMetaCampaignId(metaCampaignId: string) {
    return prisma.zapierWebhookConfig.findFirst({
      where: { metaCampaignId, isActive: true },
      include: { campaign: true, sequence: true },
    });
  }

  static async create(data: {
    campaignId: string;
    metaCampaignId: string;
    metaAdsetId?: string;
    metaFormId?: string;
    isActive?: boolean;
    channelConfig?: Record<string, unknown>;
    autoEnrollSequenceId?: string;
  }) {
    // Validate campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: data.campaignId },
    });
    if (!campaign) throw new Error("Campaign not found");

    // Validate sequence exists if provided
    if (data.autoEnrollSequenceId) {
      const sequence = await prisma.retentionSequence.findUnique({
        where: { id: data.autoEnrollSequenceId },
      });
      if (!sequence) throw new Error("Sequence not found");
    }

    return prisma.zapierWebhookConfig.create({
      data: {
        campaignId: data.campaignId,
        metaCampaignId: data.metaCampaignId,
        metaAdsetId: data.metaAdsetId ?? null,
        metaFormId: data.metaFormId ?? null,
        isActive: data.isActive ?? true,
        channelConfig: data.channelConfig
          ? JSON.stringify(data.channelConfig)
          : "{}",
        autoEnrollSequenceId: data.autoEnrollSequenceId ?? null,
      },
      include: { campaign: true, sequence: true },
    });
  }

  static async update(
    id: string,
    data: {
      metaCampaignId?: string;
      metaAdsetId?: string | null;
      metaFormId?: string | null;
      isActive?: boolean;
      channelConfig?: Record<string, unknown>;
      autoEnrollSequenceId?: string | null;
    }
  ) {
    const config = await prisma.zapierWebhookConfig.findUnique({
      where: { id },
    });
    if (!config) return null;

    // Validate sequence exists if provided
    if (data.autoEnrollSequenceId) {
      const sequence = await prisma.retentionSequence.findUnique({
        where: { id: data.autoEnrollSequenceId },
      });
      if (!sequence) throw new Error("Sequence not found");
    }

    return prisma.zapierWebhookConfig.update({
      where: { id },
      data: {
        ...(data.metaCampaignId !== undefined && {
          metaCampaignId: data.metaCampaignId,
        }),
        ...(data.metaAdsetId !== undefined && {
          metaAdsetId: data.metaAdsetId,
        }),
        ...(data.metaFormId !== undefined && { metaFormId: data.metaFormId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.channelConfig !== undefined && {
          channelConfig: JSON.stringify(data.channelConfig),
        }),
        ...(data.autoEnrollSequenceId !== undefined && {
          autoEnrollSequenceId: data.autoEnrollSequenceId,
        }),
      },
      include: { campaign: true, sequence: true },
    });
  }

  static async delete(id: string) {
    const config = await prisma.zapierWebhookConfig.findUnique({
      where: { id },
    });
    if (!config) return null;
    await prisma.zapierWebhookConfig.delete({ where: { id } });
    return config;
  }
}
