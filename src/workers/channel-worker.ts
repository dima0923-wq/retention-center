import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@/lib/db";
import { VapiService } from "@/services/channel/vapi.service";
import { SmsService } from "@/services/channel/sms.service";
import { PushService } from "@/services/channel/push.service";
import { InstantlyService } from "@/services/channel/email.service";
import { PostmarkService } from "@/services/channel/postmark.service";
import { EmailTemplateService } from "@/services/email-template.service";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

interface ChannelJobData {
  attemptId: string;
  channel: string;
  leadId: string;
  scriptId: string;
  campaignId?: string;
  campaignMeta?: string;
}

type ProviderResult = { providerRef: string } | { error: string };

async function processChannelJob(job: Job<ChannelJobData>): Promise<ProviderResult> {
  const { attemptId, channel, leadId, scriptId, campaignId, campaignMeta } = job.data;

  const [lead, script] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId } }),
    prisma.script.findUnique({ where: { id: scriptId } }),
  ]);

  if (!lead || !script) {
    const error = `Lead or script not found (lead=${leadId}, script=${scriptId})`;
    await prisma.contactAttempt.update({
      where: { id: attemptId },
      data: { status: "FAILED", completedAt: new Date(), notes: error },
    });
    return { error };
  }

  let result: ProviderResult;

  switch (channel) {
    case "CALL":
      result = await VapiService.createCall(lead, script, campaignMeta);
      break;
    case "SMS":
      result = await SmsService.sendSms(lead, script);
      break;
    case "PUSH":
      result = await PushService.sendPush(lead, script);
      break;
    case "EMAIL": {
      const pmConfig = await prisma.integrationConfig.findUnique({
        where: { provider: "postmark" },
      });
      if (pmConfig?.isActive) {
        const meta = campaignMeta ? JSON.parse(campaignMeta) : {};
        let emailTemplate: {
          subject: string;
          htmlBody: string;
          textBody?: string | null;
          fromEmail?: string;
          fromName?: string;
        } | null = null;

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

        result = await PostmarkService.sendEmail(
          lead,
          emailTemplate ?? { subject: script.name, htmlBody: script.content || "" },
          {
            tag: campaignId,
            ...(meta.emailTemplateId ? { metadata: { templateId: meta.emailTemplateId as string } } : {}),
          }
        );
        if (!("error" in result)) {
          await prisma.contactAttempt.update({
            where: { id: attemptId },
            data: { provider: "postmark" },
          });
        }
      } else {
        result = await InstantlyService.sendEmail(lead, script, campaignId ? { campaignId } : undefined);
      }
      break;
    }
    default:
      result = { error: `Unknown channel: ${channel}` };
  }

  if ("error" in result) {
    await prisma.contactAttempt.update({
      where: { id: attemptId },
      data: { status: "FAILED", completedAt: new Date(), notes: result.error },
    });
  } else {
    await prisma.contactAttempt.update({
      where: { id: attemptId },
      data: { providerRef: result.providerRef, status: "IN_PROGRESS" },
    });
  }

  return result;
}

// Rate limits: SMS=1/sec, Email=10/sec, Call=1/sec, Push=5/sec
const RATE_LIMITS: Record<string, { max: number; duration: number }> = {
  "sms-queue": { max: 1, duration: 1000 },
  "email-queue": { max: 10, duration: 1000 },
  "call-queue": { max: 1, duration: 1000 },
  "push-queue": { max: 5, duration: 1000 },
};

const workers: Worker[] = [];

export function startWorkers(): Worker[] {
  const conn = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  for (const queueName of Object.keys(RATE_LIMITS)) {
    const limit = RATE_LIMITS[queueName];
    const worker = new Worker<ChannelJobData>(queueName, processChannelJob, {
      connection: conn,
      concurrency: limit.max,
      limiter: {
        max: limit.max,
        duration: limit.duration,
      },
    });

    worker.on("failed", (job, err) => {
      console.error(`[${queueName}] Job ${job?.id} failed:`, err.message);
    });

    workers.push(worker);
  }

  return workers;
}

export async function stopWorkers() {
  await Promise.allSettled(workers.map((w) => w.close()));
  workers.length = 0;
}
