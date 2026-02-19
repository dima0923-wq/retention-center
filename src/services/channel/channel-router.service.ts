import type { Lead, Campaign } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { VapiService } from "./vapi.service";
import { SmsService } from "./sms.service";
import { InstantlyService } from "./email.service";

export class ChannelRouterService {
  static async routeContact(
    lead: Lead,
    campaign: Campaign,
    channel: string
  ): Promise<{ attemptId: string } | { error: string }> {
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

    const attempt = await prisma.contactAttempt.create({
      data: {
        leadId: lead.id,
        campaignId: campaign.id,
        channel,
        scriptId: script.id,
        status: "PENDING",
        provider: channel === "CALL" ? "vapi" : channel === "SMS" ? "sms" : "instantly",
      },
    });

    let result:
      | { providerRef: string }
      | { error: string };

    switch (channel) {
      case "CALL":
        result = await VapiService.createCall(lead, script);
        break;
      case "SMS":
        result = await SmsService.sendSms(lead, script);
        break;
      case "EMAIL":
        result = await InstantlyService.sendEmail(lead, script);
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

  static async processQueue() {
    const pending = await prisma.contactAttempt.findMany({
      where: { status: "PENDING" },
      include: { lead: true, script: true },
      take: 50,
      orderBy: { startedAt: "asc" },
    });

    const results = [];
    for (const attempt of pending) {
      if (!attempt.script || !attempt.lead) continue;

      let result:
        | { providerRef: string }
        | { error: string };

      switch (attempt.channel) {
        case "CALL":
          result = await VapiService.createCall(attempt.lead, attempt.script);
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
}
