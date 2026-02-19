import { prisma } from "@/lib/db";
import { ChannelRouterService } from "./channel/channel-router.service";

type ScheduleConfig = {
  contactHoursStart?: string; // "09:00"
  contactHoursEnd?: string;   // "18:00"
  contactDays?: number[];     // [1,2,3,4,5] (Mon-Fri, 0=Sun)
  maxContactsPerDay?: number;
  delayBetweenChannels?: number; // hours
  timezone?: string;            // e.g. "America/New_York"
};

function getScheduleConfig(campaign: { meta: string | null }): ScheduleConfig {
  if (!campaign.meta) return {};
  try {
    return JSON.parse(campaign.meta) as ScheduleConfig;
  } catch {
    return {};
  }
}

function getNowInTimezone(timezone?: string): Date {
  if (!timezone) return new Date();
  // Convert current UTC time to the campaign's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`
  );
}

export class SchedulerService {
  /**
   * Schedule a future contact attempt.
   * Creates a ContactAttempt with status='SCHEDULED' and startedAt set to the future time.
   */
  static async scheduleContact(
    leadId: string,
    campaignId: string,
    channel: string,
    scheduledAt: Date
  ) {
    const script = await prisma.script.findFirst({
      where: {
        OR: [
          { campaignId, type: channel },
          { isDefault: true, type: channel },
        ],
      },
      orderBy: { campaignId: "desc" },
    });

    const attempt = await prisma.contactAttempt.create({
      data: {
        leadId,
        campaignId,
        channel,
        scriptId: script?.id,
        status: "SCHEDULED",
        provider: channel === "CALL" ? "vapi" : channel === "SMS" ? "sms" : "instantly",
        startedAt: scheduledAt,
      },
    });

    return { attemptId: attempt.id, scheduledAt };
  }

  /**
   * Process all due scheduled contacts.
   * Finds attempts where status='SCHEDULED' and startedAt <= now, then processes them.
   */
  static async processScheduledContacts(): Promise<{ processed: number }> {
    const now = new Date();

    const dueAttempts = await prisma.contactAttempt.findMany({
      where: {
        status: "SCHEDULED",
        startedAt: { lte: now },
      },
      include: { lead: true, script: true },
      take: 100,
      orderBy: { startedAt: "asc" },
    });

    let processed = 0;

    for (const attempt of dueAttempts) {
      if (!attempt.lead) continue;

      // Check if campaign is still active
      if (attempt.campaignId) {
        const campaign = await prisma.campaign.findUnique({
          where: { id: attempt.campaignId },
          select: { status: true },
        });
        if (campaign && campaign.status === "PAUSED") {
          continue;
        }
      }

      // Route through channel-router (which will create a new attempt)
      if (attempt.campaignId) {
        const campaign = await prisma.campaign.findUnique({
          where: { id: attempt.campaignId },
        });
        if (campaign) {
          const result = await ChannelRouterService.routeContact(
            attempt.lead,
            campaign,
            attempt.channel
          );

          // Mark the scheduled attempt as completed regardless
          await prisma.contactAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "error" in result ? "FAILED" : "COMPLETED",
              completedAt: new Date(),
              notes: "error" in result ? result.error : "Processed from schedule",
            },
          });

          processed++;
        }
      }
    }

    return { processed };
  }

  /**
   * Check if now is within campaign's configured contact hours.
   */
  static async isWithinSchedule(campaignId: string): Promise<boolean> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) return false;

    const config = getScheduleConfig(campaign);

    // If no schedule configured, always allow
    if (!config.contactHoursStart && !config.contactHoursEnd && !config.contactDays) {
      return true;
    }

    const now = getNowInTimezone(config.timezone);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay(); // 0=Sun, 1=Mon, ...

    // Check day of week
    if (config.contactDays && config.contactDays.length > 0) {
      if (!config.contactDays.includes(currentDay)) {
        return false;
      }
    }

    // Check contact hours
    if (config.contactHoursStart && config.contactHoursEnd) {
      const [startH, startM] = config.contactHoursStart.split(":").map(Number);
      const [endH, endM] = config.contactHoursEnd.split(":").map(Number);

      const currentMinutes = currentHour * 60 + currentMinute;
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get contact count for lead today.
   */
  static async getLeadContactCountToday(leadId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    return prisma.contactAttempt.count({
      where: {
        leadId,
        startedAt: { gte: todayStart, lte: todayEnd },
        status: { notIn: ["CANCELLED", "SCHEDULED"] },
      },
    });
  }

  /**
   * Check if a lead can be contacted based on rate limits.
   */
  static async canContactLead(leadId: string, campaignId: string): Promise<boolean> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) return false;

    const config = getScheduleConfig(campaign);

    // Check max contacts per day
    if (config.maxContactsPerDay) {
      const todayCount = await this.getLeadContactCountToday(leadId);
      if (todayCount >= config.maxContactsPerDay) {
        return false;
      }
    }

    // Check delay between channels
    if (config.delayBetweenChannels) {
      const delayMs = config.delayBetweenChannels * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - delayMs);

      const recentAttempt = await prisma.contactAttempt.findFirst({
        where: {
          leadId,
          campaignId,
          startedAt: { gte: cutoff },
          status: { notIn: ["CANCELLED", "SCHEDULED"] },
        },
        orderBy: { startedAt: "desc" },
      });

      if (recentAttempt) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate next available contact slot for a campaign.
   */
  static async getNextAvailableSlot(campaignId: string): Promise<Date> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) return new Date();

    const config = getScheduleConfig(campaign);
    const now = getNowInTimezone(config.timezone);

    // Start from next hour
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);

    // Try up to 7 days ahead
    for (let i = 0; i < 7 * 24; i++) {
      const candidate = new Date(next.getTime() + i * 60 * 60 * 1000);
      const day = candidate.getDay();
      const hour = candidate.getHours();
      const minute = candidate.getMinutes();

      // Check day
      if (config.contactDays && config.contactDays.length > 0) {
        if (!config.contactDays.includes(day)) continue;
      }

      // Check hours
      if (config.contactHoursStart && config.contactHoursEnd) {
        const [startH, startM] = config.contactHoursStart.split(":").map(Number);
        const [endH, endM] = config.contactHoursEnd.split(":").map(Number);
        const mins = hour * 60 + minute;
        if (mins < startH * 60 + startM || mins >= endH * 60 + endM) continue;
      }

      return candidate;
    }

    // Fallback: schedule for tomorrow at start hour
    const fallback = new Date(now);
    fallback.setDate(fallback.getDate() + 1);
    if (config.contactHoursStart) {
      const [h, m] = config.contactHoursStart.split(":").map(Number);
      fallback.setHours(h, m, 0, 0);
    } else {
      fallback.setHours(9, 0, 0, 0);
    }
    return fallback;
  }
}
