import * as postmark from "postmark";
import type { Lead } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type PostmarkConfig = {
  serverToken: string;
  fromEmail?: string;
  fromName?: string;
};

function replaceVariables(template: string, lead: Lead): string {
  return template
    .replace(/\{\{firstName\}\}/g, lead.firstName)
    .replace(/\{\{lastName\}\}/g, lead.lastName)
    .replace(/\{\{phone\}\}/g, lead.phone ?? "")
    .replace(/\{\{email\}\}/g, lead.email ?? "");
}

async function getConfig(): Promise<PostmarkConfig | null> {
  const config = await prisma.integrationConfig.findUnique({
    where: { provider: "postmark" },
  });
  if (!config || !config.isActive) return null;
  return JSON.parse(config.config as string) as PostmarkConfig;
}

export class PostmarkService {
  static async sendEmail(
    lead: Lead,
    template: {
      subject: string;
      htmlBody: string;
      textBody?: string | null;
      fromEmail?: string;
      fromName?: string;
    },
    options?: { tag?: string; metadata?: Record<string, string> }
  ): Promise<{ providerRef: string } | { error: string }> {
    const config = await getConfig();
    if (!config)
      return { error: "Postmark integration not configured or inactive" };
    if (!lead.email) return { error: "Lead has no email address" };

    const client = new postmark.ServerClient(config.serverToken);
    const subject = replaceVariables(template.subject, lead);
    const htmlBody = replaceVariables(template.htmlBody, lead);
    const textBody = template.textBody
      ? replaceVariables(template.textBody, lead)
      : undefined;

    try {
      const result = await client.sendEmail({
        From: `${template.fromName || config.fromName || "Retention Center"} <${template.fromEmail || config.fromEmail || "noreply@example.com"}>`,
        To: lead.email,
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: textBody || undefined,
        Tag: options?.tag,
        Metadata: options?.metadata,
        TrackOpens: true,
        TrackLinks: postmark.Models.LinkTrackingOptions.HtmlAndText,
        MessageStream: "outbound",
      });
      return { providerRef: result.MessageID };
    } catch (e) {
      return { error: `Postmark error: ${(e as Error).message}` };
    }
  }

  static async sendBatchEmail(
    leads: Lead[],
    template: {
      subject: string;
      htmlBody: string;
      textBody?: string | null;
      fromEmail?: string;
      fromName?: string;
    },
    options?: { tag?: string }
  ): Promise<{ sent: number; errors: number }> {
    const config = await getConfig();
    if (!config) return { sent: 0, errors: leads.length };

    const client = new postmark.ServerClient(config.serverToken);
    const fromAddress = `${template.fromName || config.fromName || "Retention Center"} <${template.fromEmail || config.fromEmail || "noreply@example.com"}>`;

    const leadsWithEmail = leads.filter((l) => l.email);
    if (leadsWithEmail.length === 0) return { sent: 0, errors: leads.length };

    const messages: postmark.Models.Message[] = leadsWithEmail.map((lead) => ({
      From: fromAddress,
      To: lead.email!,
      Subject: replaceVariables(template.subject, lead),
      HtmlBody: replaceVariables(template.htmlBody, lead),
      TextBody: template.textBody
        ? replaceVariables(template.textBody, lead)
        : undefined,
      Tag: options?.tag,
      TrackOpens: true,
      TrackLinks: postmark.Models.LinkTrackingOptions.HtmlAndText,
      MessageStream: "outbound",
    }));

    // Postmark batch API supports up to 500 messages per call
    let sent = 0;
    let errors = leads.length - leadsWithEmail.length; // leads without email

    const BATCH_SIZE = 500;
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      try {
        const results = await client.sendEmailBatch(batch);
        for (const r of results) {
          if (r.ErrorCode === 0) {
            sent++;
          } else {
            errors++;
          }
        }
      } catch {
        errors += batch.length;
      }
    }

    return { sent, errors };
  }

  static async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const config = await getConfig();
    if (!config) return { ok: false, error: "Not configured" };
    try {
      const client = new postmark.ServerClient(config.serverToken);
      await client.getServer();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  static async handleWebhookEvent(
    data: Record<string, unknown>
  ): Promise<void> {
    const messageId = data.MessageID as string;
    if (!messageId) return;

    const attempt = await prisma.contactAttempt.findFirst({
      where: { providerRef: messageId, provider: "postmark" },
      orderBy: { startedAt: "desc" },
    });
    if (!attempt) return;

    const recordType = data.RecordType as string;
    const statusMap: Record<string, string> = {
      Delivery: "SUCCESS",
      Bounce: "FAILED",
      Open: "SUCCESS",
      Click: "SUCCESS",
      SpamComplaint: "FAILED",
    };
    const newStatus = statusMap[recordType] ?? "IN_PROGRESS";

    await prisma.contactAttempt.update({
      where: { id: attempt.id },
      data: {
        status: newStatus,
        completedAt: ["SUCCESS", "FAILED"].includes(newStatus)
          ? new Date()
          : undefined,
        result: JSON.stringify(data),
      },
    });
  }
}

// Re-export as EmailService for channel router compatibility
export { PostmarkService as EmailService };
