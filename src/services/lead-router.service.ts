import { prisma } from "@/lib/db";
import type { Lead, Campaign } from "@/generated/prisma/client";
import { ChannelRouterService } from "./channel/channel-router.service";

const CHANNEL_PRIORITY: Record<string, number> = {
  EMAIL: 0,
  SMS: 1,
  CALL: 2,
};

export class LeadRouterService {
  /**
   * Auto-assign a new lead to all matching active campaigns.
   * Creates CampaignLead entries and queues ALL channels simultaneously for each.
   */
  static async routeNewLead(leadId: string): Promise<{ assigned: string[] }> {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { assigned: [] };

    const campaigns = await this.findMatchingCampaigns(lead);
    const assigned: string[] = [];

    for (const campaign of campaigns) {
      // Check if already assigned
      const existing = await prisma.campaignLead.findUnique({
        where: { campaignId_leadId: { campaignId: campaign.id, leadId: lead.id } },
      });
      if (existing) continue;

      // Check maxLeads limit
      const meta = campaign.meta ? JSON.parse(campaign.meta as string) : {};
      const autoAssign = meta.autoAssign;
      if (autoAssign?.maxLeads) {
        const currentCount = await prisma.campaignLead.count({
          where: { campaignId: campaign.id },
        });
        if (currentCount >= autoAssign.maxLeads) continue;
      }

      // Create CampaignLead entry
      await prisma.campaignLead.create({
        data: { campaignId: campaign.id, leadId: lead.id },
      });

      // Queue ALL channels simultaneously (SMS + Email + Call in parallel)
      await this.queueAllChannels(leadId, campaign.id).catch((err) => {
        console.error(`Failed to queue channels for lead ${leadId} in campaign ${campaign.id}:`, err);
      });

      assigned.push(campaign.id);
    }

    return { assigned };
  }

  /**
   * Find active campaigns whose autoAssign rules match this lead's source.
   */
  static async findMatchingCampaigns(lead: Lead): Promise<Campaign[]> {
    const activeCampaigns = await prisma.campaign.findMany({
      where: { status: "ACTIVE" },
    });

    return activeCampaigns.filter((campaign) => {
      const meta = campaign.meta ? JSON.parse(campaign.meta as string) : {};
      const autoAssign = meta.autoAssign;

      // If no autoAssign rules, campaign doesn't accept auto-routed leads
      if (!autoAssign) return false;

      // Check source matching
      if (autoAssign.sources && Array.isArray(autoAssign.sources)) {
        return autoAssign.sources.includes(lead.source);
      }

      // If autoAssign exists but no sources filter, accept all
      return true;
    });
  }

  /**
   * Queue ALL viable channels for a lead in a campaign simultaneously.
   * Fires SMS + Email + Call in parallel using Promise.allSettled().
   */
  static async queueAllChannels(leadId: string, campaignId: string): Promise<void> {
    const [lead, campaign] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId } }),
      prisma.campaign.findUnique({ where: { id: campaignId } }),
    ]);

    if (!lead || !campaign) return;

    const channels: string[] = typeof campaign.channels === "string"
      ? JSON.parse(campaign.channels)
      : campaign.channels;

    // Filter to only viable channels (lead has required contact info)
    const viableChannels = channels.filter((channel) => {
      if (channel === "EMAIL" && !lead.email) return false;
      if (channel === "SMS" && !lead.phone) return false;
      if (channel === "CALL" && !lead.phone) return false;
      return true;
    });

    if (viableChannels.length === 0) return;

    // Fire ALL channels in parallel
    const results = await Promise.allSettled(
      viableChannels.map((channel) =>
        ChannelRouterService.routeContact(lead, campaign, channel).then((result) => {
          if ("error" in result) {
            console.error(`LeadRouter: Failed ${channel} for lead ${leadId}:`, result.error);
          }
          return { channel, result };
        })
      )
    );

    // Check if at least one channel succeeded
    const anySuccess = results.some(
      (r) => r.status === "fulfilled" && !("error" in r.value.result)
    );

    if (anySuccess) {
      await prisma.campaignLead.updateMany({
        where: { campaignId, leadId },
        data: { status: "IN_PROGRESS" },
      });
    }
  }
}
