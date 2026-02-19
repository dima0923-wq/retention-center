import type { Lead, Campaign } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { VapiService } from "./vapi.service";
import { SmsService } from "./sms.service";
import { InstantlyService } from "./email.service";
import { ABTestService } from "@/services/ab-test.service";
import { SchedulerService } from "../scheduler.service";

// Channel priority: EMAIL first, then SMS, then CALL
const CHANNEL_PRIORITY: Record<string, number> = {
  EMAIL: 0,
  SMS: 1,
  CALL: 2,
};

const DEFAULT_MAX_CONTACTS_PER_LEAD = 5;

export class ChannelRouterService {
  static async routeContact(
    lead: Lead,
    campaign: Campaign,
    channel: string
  ): Promise<{ attemptId: string } | { error: string }> {
    // Check per-lead contact limit
    const meta = campaign.meta ? JSON.parse(campaign.meta as string) : {};
    const maxContacts = meta.maxContactsPerLead ?? DEFAULT_MAX_CONTACTS_PER_LEAD;

    const existingAttempts = await prisma.contactAttempt.count({
      where: { leadId: lead.id, campaignId: campaign.id },
    });

    if (existingAttempts >= maxContacts) {
      return { error: `Lead ${lead.id} has reached max contact limit (${maxContacts})` };
    }

    // Check schedule and rate limits — if outside hours or rate limited, schedule for next slot
    const withinSchedule = await SchedulerService.isWithinSchedule(campaign.id);
    const canContact = await SchedulerService.canContactLead(lead.id, campaign.id);

    if (!withinSchedule || !canContact) {
      const nextSlot = await SchedulerService.getNextAvailableSlot(campaign.id);
      const scheduled = await SchedulerService.scheduleContact(
        lead.id,
        campaign.id,
        channel,
        nextSlot
      );
      return { attemptId: scheduled.attemptId };
    }

    // Check for active A/B test for this campaign + channel
    let scriptId: string | null = null;
    let abTestNote: string | null = null;

    const activeTest = await ABTestService.getActiveTest(campaign.id, channel);
    if (activeTest) {
      const { variant, scriptId: selectedScriptId } =
        await ABTestService.selectVariant(activeTest.id);
      scriptId = selectedScriptId;
      abTestNote = `ab_test:${activeTest.id}:variant:${variant}`;
    }

    // If no A/B test, fall back to default script selection
    if (!scriptId) {
      const script = await prisma.script.findFirst({
        where: {
          OR: [
            { campaignId: campaign.id, type: channel },
            { isDefault: true, type: channel },
          ],
        },
        orderBy: { campaignId: "desc" },
      });

      if (!script) {
        return { error: `No script found for channel ${channel}` };
      }
      scriptId = script.id;
    }

    const attempt = await prisma.contactAttempt.create({
      data: {
        leadId: lead.id,
        campaignId: campaign.id,
        channel,
        scriptId,
        status: "PENDING",
        provider: channel === "CALL" ? "vapi" : channel === "SMS" ? "sms" : "instantly",
        notes: abTestNote,
      },
    });

    // Fetch the full script object for channel providers
    const selectedScript = await prisma.script.findUnique({
      where: { id: scriptId },
    });

    if (!selectedScript) {
      return { error: `Script ${scriptId} not found` };
    }

    let result:
      | { providerRef: string }
      | { error: string };

    switch (channel) {
      case "CALL":
        result = await VapiService.createCall(lead, selectedScript, campaign.meta);
        break;
      case "SMS":
        result = await SmsService.sendSms(lead, selectedScript);
        break;
      case "EMAIL":
        result = await InstantlyService.sendEmail(lead, selectedScript);
        break;
      default:
        result = { error: `Unknown channel: ${channel}` };
    }

    if ("error" in result) {
      await prisma.contactAttempt.update({
        where: { id: attempt.id },
        data: { status: "FAILED", completedAt: new Date(), notes: result.error },
      });
      return { error: result.error };
    }

    await prisma.contactAttempt.update({
      where: { id: attempt.id },
      data: { providerRef: result.providerRef, status: "IN_PROGRESS" },
    });

    return { attemptId: attempt.id };
  }

  /**
   * Queue all leads in a campaign for contact through ALL configured channels simultaneously.
   * Each lead gets contacted via every viable channel in parallel.
   */
  static async queueCampaignLeads(
    campaignId: string
  ): Promise<{ queued: number; skipped: number; errors: string[] }> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) return { queued: 0, skipped: 0, errors: ["Campaign not found"] };

    const channels: string[] = typeof campaign.channels === "string"
      ? JSON.parse(campaign.channels)
      : campaign.channels;

    // Sort channels by priority: EMAIL first, SMS second, CALL last
    const sortedChannels = [...channels].sort(
      (a, b) => (CHANNEL_PRIORITY[a] ?? 99) - (CHANNEL_PRIORITY[b] ?? 99)
    );

    const campaignLeads = await prisma.campaignLead.findMany({
      where: { campaignId, status: "PENDING" },
      include: { lead: true },
    });

    let queued = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const cl of campaignLeads) {
      const lead = cl.lead;

      // Find all viable channels for this lead
      const viableChannels = sortedChannels.filter((channel) => {
        if (channel === "EMAIL" && !lead.email) return false;
        if (channel === "SMS" && !lead.phone) return false;
        if (channel === "CALL" && !lead.phone) return false;
        return true;
      });

      if (viableChannels.length === 0) {
        skipped++;
        continue;
      }

      // Fire ALL viable channels in parallel
      const results = await Promise.allSettled(
        viableChannels.map((channel) =>
          this.routeContact(lead, campaign, channel).then((result) => {
            if ("error" in result) {
              errors.push(`Lead ${lead.id} / ${channel}: ${result.error}`);
            }
            return { channel, result };
          })
        )
      );

      const anySuccess = results.some(
        (r) => r.status === "fulfilled" && !("error" in r.value.result)
      );

      if (anySuccess) {
        queued++;
        await prisma.campaignLead.update({
          where: { id: cl.id },
          data: { status: "IN_PROGRESS" },
        });
      } else {
        skipped++;
      }
    }

    return { queued, skipped, errors };
  }

  static async processQueue() {
    // Fetch pending attempts, ordered by channel priority (EMAIL first, SMS, CALL)
    const pending = await prisma.contactAttempt.findMany({
      where: { status: "PENDING" },
      include: { lead: true, script: true },
      take: 50,
      orderBy: { startedAt: "asc" },
    });

    // Sort by channel priority
    pending.sort(
      (a, b) => (CHANNEL_PRIORITY[a.channel] ?? 99) - (CHANNEL_PRIORITY[b.channel] ?? 99)
    );

    const results = [];
    for (const attempt of pending) {
      if (!attempt.script || !attempt.lead) continue;

      // Check if campaign is still active
      let campaignMeta: unknown = undefined;
      if (attempt.campaignId) {
        const campaign = await prisma.campaign.findUnique({
          where: { id: attempt.campaignId },
          select: { status: true, meta: true },
        });
        if (campaign && campaign.status === "PAUSED") {
          // Skip paused campaign attempts
          continue;
        }
        campaignMeta = campaign?.meta;
      }

      let result:
        | { providerRef: string }
        | { error: string };

      switch (attempt.channel) {
        case "CALL":
          result = await VapiService.createCall(attempt.lead, attempt.script, campaignMeta);
          break;
        case "SMS":
          result = await SmsService.sendSms(attempt.lead, attempt.script);
          break;
        case "EMAIL":
          result = await InstantlyService.sendEmail(attempt.lead, attempt.script);
          break;
        default:
          result = { error: `Unknown channel` };
      }

      if ("error" in result) {
        await prisma.contactAttempt.update({
          where: { id: attempt.id },
          data: { status: "FAILED", completedAt: new Date(), notes: result.error },
        });
      } else {
        await prisma.contactAttempt.update({
          where: { id: attempt.id },
          data: { providerRef: result.providerRef, status: "IN_PROGRESS" },
        });
      }

      results.push({ id: attempt.id, result });
    }

    return { processed: results.length, results };
  }

  /**
   * Cancel all pending attempts for a campaign (used when pausing).
   */
  static async cancelPendingAttempts(campaignId: string): Promise<{ cancelled: number }> {
    const result = await prisma.contactAttempt.updateMany({
      where: { campaignId, status: "PENDING" },
      data: { status: "CANCELLED", completedAt: new Date(), notes: "Campaign paused" },
    });
    return { cancelled: result.count };
  }
}
