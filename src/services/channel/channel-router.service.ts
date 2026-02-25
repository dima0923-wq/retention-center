import type { Lead, Campaign } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { VapiService } from "./vapi.service";
import { SmsService } from "./sms.service";
import { PushService } from "./push.service";
import { InstantlyService } from "./email.service";
import { PostmarkService } from "./postmark.service";
import { ABTestService } from "@/services/ab-test.service";
import { SchedulerService } from "../scheduler.service";
import { EmailTemplateService } from "@/services/email-template.service";
import { addChannelJob, isRedisConnected } from "@/lib/queue";

// Channel priority: EMAIL first, then SMS, then CALL, then PUSH
const CHANNEL_PRIORITY: Record<string, number> = {
  EMAIL: 0,
  SMS: 1,
  CALL: 2,
  PUSH: 3,
};

const DEFAULT_MAX_CONTACTS_PER_LEAD = 5;

export class ChannelRouterService {
  static async routeContact(
    lead: Lead,
    campaign: Campaign,
    channel: string,
    overrideScriptId?: string
  ): Promise<{ attemptId: string } | { error: string }> {
    // Check DO_NOT_CONTACT preference — skip routing entirely
    if (lead.status === "DO_NOT_CONTACT") {
      return { error: `Lead ${lead.id} has DO_NOT_CONTACT status — skipping` };
    }

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

    // Check for override scriptId (e.g. from Zapier channelConfig)
    let scriptId: string | null = overrideScriptId ?? null;
    let abTestNote: string | null = null;

    if (!scriptId) {
      // Check for active A/B test for this campaign + channel
      const activeTest = await ABTestService.getActiveTest(campaign.id, channel);
      if (activeTest) {
        const { variant, scriptId: selectedScriptId } =
          await ABTestService.selectVariant(activeTest.id);
        scriptId = selectedScriptId;
        abTestNote = `ab_test:${activeTest.id}:variant:${variant}`;
      }
    }

    // If no A/B test, fall back to default script selection
    let selectedScript: Awaited<ReturnType<typeof prisma.script.findFirst>> | null = null;
    if (!scriptId) {
      selectedScript = await prisma.script.findFirst({
        where: {
          OR: [
            { campaignId: campaign.id, type: channel },
            { isDefault: true, type: channel },
          ],
        },
        orderBy: { campaignId: "desc" },
      });

      if (!selectedScript) {
        return { error: `No script found for channel ${channel}` };
      }
      scriptId = selectedScript.id;
    }

    const attempt = await prisma.contactAttempt.create({
      data: {
        leadId: lead.id,
        campaignId: campaign.id,
        channel,
        scriptId,
        status: "PENDING",
        provider: channel === "CALL" ? "vapi" : channel === "SMS" ? "sms" : channel === "PUSH" ? "pwaflow" : "email",
        notes: abTestNote,
      },
    });

    // If we didn't fetch the script above (A/B test path), fetch it now
    if (!selectedScript) {
      selectedScript = await prisma.script.findUnique({
        where: { id: scriptId },
      });
    }

    if (!selectedScript) {
      await prisma.contactAttempt.update({
        where: { id: attempt.id },
        data: { status: "FAILED", completedAt: new Date(), notes: `Script ${scriptId} not found` },
      });
      return { error: `Script ${scriptId} not found` };
    }

    // Try to enqueue via BullMQ (Redis). Falls back to direct send if unavailable.
    if (isRedisConnected()) {
      const enqueued = await addChannelJob(channel, {
        attemptId: attempt.id,
        channel,
        leadId: lead.id,
        scriptId: selectedScript.id,
        campaignId: campaign.id,
        campaignMeta: typeof campaign.meta === "string" ? campaign.meta : JSON.stringify(campaign.meta),
      });
      if (enqueued) {
        return { attemptId: attempt.id };
      }
    }

    // Fallback: direct synchronous send (original behavior)
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
      case "PUSH":
        result = await PushService.sendPush(lead, selectedScript);
        break;
      case "EMAIL": {
        // Check if Postmark is active — use it as primary email provider
        const postmarkConfig = await prisma.integrationConfig.findUnique({
          where: { provider: "postmark" },
        });
        if (postmarkConfig?.isActive) {
          // Check for email template in campaign meta
          let emailTemplate: { subject: string; htmlBody: string; textBody?: string | null; fromEmail?: string; fromName?: string } | null = null;
          if (meta.emailTemplateId) {
            const tpl = await EmailTemplateService.getById(meta.emailTemplateId as string);
            if (tpl && tpl.isActive) {
              const leadVars: Record<string, string> = {
                firstName: lead.firstName,
                lastName: lead.lastName,
                email: lead.email ?? "",
                phone: lead.phone ?? "",
              };
              const rendered = EmailTemplateService.renderTemplate(tpl, leadVars);
              emailTemplate = {
                subject: rendered.subject,
                htmlBody: rendered.htmlBody,
                textBody: rendered.textBody,
                fromEmail: tpl.fromEmail,
                fromName: tpl.fromName,
              };
            }
          }

          result = await PostmarkService.sendEmail(lead, emailTemplate ?? {
            subject: selectedScript.name,
            htmlBody: selectedScript.content || "",
          }, {
            tag: campaign.id,
            ...(meta.emailTemplateId ? { metadata: { templateId: meta.emailTemplateId as string } } : {}),
          });
          // Update provider on the attempt record
          if (!("error" in result)) {
            await prisma.contactAttempt.update({
              where: { id: attempt.id },
              data: { provider: "postmark" },
            });
          }
        } else {
          result = await InstantlyService.sendEmail(lead, selectedScript, { campaignId: campaign.id });
        }
        break;
      }
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
        if (channel === "PUSH") {
          const meta = lead.meta ? (typeof lead.meta === "string" ? JSON.parse(lead.meta) : lead.meta) as Record<string, unknown> : {};
          if (!meta.pwaUserId) return false;
        }
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

    if (pending.length === 0) return { processed: 0, results: [] };

    // Batch: fetch all referenced campaigns in one query
    const campaignIds = [...new Set(
      pending.map((a) => a.campaignId).filter(Boolean) as string[]
    )];
    const campaigns = campaignIds.length > 0
      ? await prisma.campaign.findMany({
          where: { id: { in: campaignIds } },
          select: { id: true, status: true, meta: true },
        })
      : [];
    const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

    // Batch: fetch postmark config once (used by all EMAIL attempts)
    const hasEmailAttempts = pending.some((a) => a.channel === "EMAIL");
    const postmarkConfig = hasEmailAttempts
      ? await prisma.integrationConfig.findUnique({ where: { provider: "postmark" } })
      : null;

    const results = [];
    for (const attempt of pending) {
      if (!attempt.script || !attempt.lead) continue;

      // Check if campaign is still active (from batch-fetched map)
      let campaignMeta: unknown = undefined;
      if (attempt.campaignId) {
        const campaign = campaignMap.get(attempt.campaignId);
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
        case "PUSH":
          result = await PushService.sendPush(attempt.lead, attempt.script);
          break;
        case "EMAIL": {
          if (postmarkConfig?.isActive) {
            // Check for email template in campaign meta
            const qMeta = campaignMeta ? JSON.parse(campaignMeta as string) : {};
            let qEmailTemplate: { subject: string; htmlBody: string; textBody?: string | null; fromEmail?: string; fromName?: string } | null = null;
            if (qMeta.emailTemplateId) {
              const tpl = await EmailTemplateService.getById(qMeta.emailTemplateId as string);
              if (tpl && tpl.isActive) {
                const leadVars: Record<string, string> = {
                  firstName: attempt.lead.firstName,
                  lastName: attempt.lead.lastName,
                  email: attempt.lead.email ?? "",
                  phone: attempt.lead.phone ?? "",
                };
                const rendered = EmailTemplateService.renderTemplate(tpl, leadVars);
                qEmailTemplate = {
                  subject: rendered.subject,
                  htmlBody: rendered.htmlBody,
                  textBody: rendered.textBody,
                  fromEmail: tpl.fromEmail,
                  fromName: tpl.fromName,
                };
              }
            }

            result = await PostmarkService.sendEmail(attempt.lead, qEmailTemplate ?? {
              subject: attempt.script.name,
              htmlBody: attempt.script.content || "",
            });
            if (!("error" in result)) {
              await prisma.contactAttempt.update({
                where: { id: attempt.id },
                data: { provider: "postmark" },
              });
            }
          } else {
            result = await InstantlyService.sendEmail(attempt.lead, attempt.script);
          }
          break;
        }
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
