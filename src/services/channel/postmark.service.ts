import * as postmark from "postmark";
import type { Lead } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type PostmarkConfig = {
  serverToken: string;
  accountToken?: string;
  fromEmail?: string;
  fromName?: string;
};

type MessageStreamId = "outbound" | "broadcast" | (string & {});

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

function getServerClient(config: PostmarkConfig): postmark.ServerClient {
  return new postmark.ServerClient(config.serverToken);
}

function getAccountClient(config: PostmarkConfig): postmark.AccountClient {
  if (!config.accountToken) {
    throw new Error("Postmark account token not configured — required for sender signatures and domain management");
  }
  return new postmark.AccountClient(config.accountToken);
}

export class PostmarkService {
  // ─── Sending ──────────────────────────────────────────────

  static async sendEmail(
    lead: Lead,
    template: {
      subject: string;
      htmlBody: string;
      textBody?: string | null;
      fromEmail?: string;
      fromName?: string;
    },
    options?: { tag?: string; metadata?: Record<string, string>; messageStream?: MessageStreamId }
  ): Promise<{ providerRef: string } | { error: string }> {
    const config = await getConfig();
    if (!config)
      return { error: "Postmark integration not configured or inactive" };
    if (!lead.email) return { error: "Lead has no email address" };

    const client = getServerClient(config);
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
        MessageStream: options?.messageStream || "outbound",
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
    options?: { tag?: string; messageStream?: MessageStreamId }
  ): Promise<{ sent: number; errors: number }> {
    const config = await getConfig();
    if (!config) return { sent: 0, errors: leads.length };

    const client = getServerClient(config);
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
      MessageStream: options?.messageStream || "outbound",
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

  /**
   * Batch-send emails from a pre-built queue of items.
   * Chunks into groups of 50 and calls sendEmailBatch for each chunk.
   * Returns per-item results (success with MessageID or error string).
   */
  static async batchSendFromQueue(
    items: Array<{
      lead: Lead;
      subject: string;
      htmlBody: string;
      textBody?: string | null;
      fromEmail?: string;
      fromName?: string;
      tag?: string;
    }>
  ): Promise<Array<{ index: number; providerRef?: string; error?: string }>> {
    const config = await getConfig();
    if (!config) {
      return items.map((_, i) => ({ index: i, error: "Postmark integration not configured or inactive" }));
    }

    const client = getServerClient(config);
    const results: Array<{ index: number; providerRef?: string; error?: string }> = [];

    // Build messages, tracking original index
    const validItems: Array<{ index: number; message: postmark.Models.Message }> = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.lead.email) {
        results.push({ index: i, error: "Lead has no email address" });
        continue;
      }
      validItems.push({
        index: i,
        message: {
          From: `${item.fromName || config.fromName || "Retention Center"} <${item.fromEmail || config.fromEmail || "noreply@example.com"}>`,
          To: item.lead.email,
          Subject: replaceVariables(item.subject, item.lead),
          HtmlBody: replaceVariables(item.htmlBody, item.lead),
          TextBody: item.textBody ? replaceVariables(item.textBody, item.lead) : undefined,
          Tag: item.tag,
          TrackOpens: true,
          TrackLinks: postmark.Models.LinkTrackingOptions.HtmlAndText,
          MessageStream: "outbound",
        },
      });
    }

    // Chunk into groups of 50
    const CHUNK_SIZE = 50;
    for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
      const chunk = validItems.slice(i, i + CHUNK_SIZE);
      try {
        const batchResults = await client.sendEmailBatch(chunk.map((c) => c.message));
        for (let j = 0; j < batchResults.length; j++) {
          const r = batchResults[j];
          if (r.ErrorCode === 0) {
            results.push({ index: chunk[j].index, providerRef: r.MessageID });
          } else {
            results.push({ index: chunk[j].index, error: `Postmark error ${r.ErrorCode}: ${r.Message}` });
          }
        }
      } catch (e) {
        for (const c of chunk) {
          results.push({ index: c.index, error: `Postmark batch error: ${(e as Error).message}` });
        }
      }
    }

    // Sort by original index for predictable output
    results.sort((a, b) => a.index - b.index);
    return results;
  }

  static async sendEmailWithTemplate(
    lead: Lead,
    options: {
      templateIdOrAlias: number | string;
      templateModel: Record<string, unknown>;
      fromEmail?: string;
      fromName?: string;
      tag?: string;
      metadata?: Record<string, string>;
      messageStream?: MessageStreamId;
    }
  ): Promise<{ providerRef: string } | { error: string }> {
    const config = await getConfig();
    if (!config)
      return { error: "Postmark integration not configured or inactive" };
    if (!lead.email) return { error: "Lead has no email address" };

    const client = getServerClient(config);

    try {
      const result = await client.sendEmailWithTemplate({
        From: `${options.fromName || config.fromName || "Retention Center"} <${options.fromEmail || config.fromEmail || "noreply@example.com"}>`,
        To: lead.email,
        TemplateId: typeof options.templateIdOrAlias === "number" ? options.templateIdOrAlias : undefined,
        TemplateAlias: typeof options.templateIdOrAlias === "string" ? options.templateIdOrAlias : undefined,
        TemplateModel: options.templateModel,
        Tag: options.tag,
        Metadata: options.metadata,
        TrackOpens: true,
        TrackLinks: postmark.Models.LinkTrackingOptions.HtmlAndText,
        MessageStream: options.messageStream || "outbound",
      });
      return { providerRef: result.MessageID };
    } catch (e) {
      return { error: `Postmark error: ${(e as Error).message}` };
    }
  }

  // ─── Connection / Server ──────────────────────────────────

  static async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const config = await getConfig();
    if (!config) return { ok: false, error: "Not configured" };
    try {
      const client = getServerClient(config);
      await client.getServer();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  // ─── Webhooks ─────────────────────────────────────────────

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

  // ─── Sender Signatures (requires accountToken) ───────────

  static async listSenderSignatures(
    filter?: { count?: number; offset?: number }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const account = getAccountClient(config);
      return await account.getSenderSignatures(filter);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async createSenderSignature(
    options: { fromEmail: string; name: string; replyToEmail?: string }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const account = getAccountClient(config);
      return await account.createSenderSignature({
        FromEmail: options.fromEmail,
        Name: options.name,
        ReplyToEmail: options.replyToEmail,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async resendSignatureConfirmation(signatureId: number) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const account = getAccountClient(config);
      return await account.resendSenderSignatureConfirmation(signatureId);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  // ─── Domains (requires accountToken) ─────────────────────

  static async listDomains(filter?: { count?: number; offset?: number }) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const account = getAccountClient(config);
      return await account.getDomains(filter);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async getDomainDetails(domainId: number) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const account = getAccountClient(config);
      return await account.getDomain(domainId);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async verifyDomainDKIM(domainId: number) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const account = getAccountClient(config);
      return await account.verifyDomainDKIM(domainId);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async verifyDomainReturnPath(domainId: number) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const account = getAccountClient(config);
      return await account.verifyDomainReturnPath(domainId);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  // ─── Stats / Analytics ────────────────────────────────────

  static async getOutboundStats(
    filter?: { tag?: string; fromDate?: string; toDate?: string }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getOutboundOverview(filter);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async getSentCounts(
    filter?: { tag?: string; fromDate?: string; toDate?: string }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getSentCounts(filter);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async getBounceCounts(
    filter?: { tag?: string; fromDate?: string; toDate?: string }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getBounceCounts(filter);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async getSpamComplaintCounts(
    filter?: { tag?: string; fromDate?: string; toDate?: string }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getSpamComplaintsCounts(filter);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async getTrackedEmailCounts(
    filter?: { tag?: string; fromDate?: string; toDate?: string }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getTrackedEmailCounts(filter);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async getOpenCounts(
    filter?: { tag?: string; fromDate?: string; toDate?: string }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getEmailOpenCounts(filter);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async getClickCounts(
    filter?: { tag?: string; fromDate?: string; toDate?: string }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getClickCounts(filter);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  // ─── Bounce Management ────────────────────────────────────

  static async getDeliveryStatistics() {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getDeliveryStatistics();
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async getBounces(
    filter?: postmark.Models.BounceFilteringParameters
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getBounces(filter);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async getBounce(bounceId: number) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getBounce(bounceId);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async activateBounce(bounceId: number) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.activateBounce(bounceId);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  // ─── Suppression Management ───────────────────────────────

  static async getSuppressions(
    messageStream: MessageStreamId = "outbound",
    filter?: postmark.Models.SuppressionFilteringParameters
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getSuppressions(messageStream, filter);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async createSuppressions(
    emailAddresses: string[],
    messageStream: MessageStreamId = "outbound"
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.createSuppressions(messageStream, {
        Suppressions: emailAddresses.map((e) => ({ EmailAddress: e })),
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async deleteSuppressions(
    emailAddresses: string[],
    messageStream: MessageStreamId = "outbound"
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.deleteSuppressions(messageStream, {
        Suppressions: emailAddresses.map((e) => ({ EmailAddress: e })),
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  // ─── Message Streams ──────────────────────────────────────

  static async listMessageStreams(
    filter?: { messageStreamType?: string; includeArchivedStreams?: boolean }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getMessageStreams(filter);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async getMessageStream(streamId: string) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getMessageStream(streamId);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async createMessageStream(
    options: { id: string; name: string; messageStreamType: string; description?: string }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.createMessageStream({
        ID: options.id,
        Name: options.name,
        MessageStreamType: options.messageStreamType as "Transactional" | "Broadcasts" | "Inbound",
        Description: options.description,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async archiveMessageStream(streamId: string) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.archiveMessageStream(streamId);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async unarchiveMessageStream(streamId: string) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.unarchiveMessageStream(streamId);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  // ─── Postmark Templates ───────────────────────────────────

  static async listTemplates(
    filter?: postmark.Models.TemplateFilteringParameters
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getTemplates(filter);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async getTemplate(idOrAlias: number | string) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.getTemplate(idOrAlias);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async createTemplate(
    options: { name: string; subject: string; htmlBody?: string; textBody?: string; alias?: string; templateType?: string }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.createTemplate({
        Name: options.name,
        Subject: options.subject,
        HtmlBody: options.htmlBody,
        TextBody: options.textBody,
        Alias: options.alias,
        TemplateType: options.templateType as postmark.Models.TemplateTypes | undefined,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async updateTemplate(
    idOrAlias: number | string,
    options: { name?: string; subject?: string; htmlBody?: string; textBody?: string }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.editTemplate(idOrAlias, {
        Name: options.name,
        Subject: options.subject,
        HtmlBody: options.htmlBody,
        TextBody: options.textBody,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async deleteTemplate(idOrAlias: number | string) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.deleteTemplate(idOrAlias);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  static async validateTemplate(
    options: { subject: string; htmlBody?: string; textBody?: string; testRenderModel?: Record<string, unknown> }
  ) {
    const config = await getConfig();
    if (!config) return { error: "Not configured" };
    try {
      const client = getServerClient(config);
      return await client.validateTemplate({
        Subject: options.subject,
        HtmlBody: options.htmlBody,
        TextBody: options.textBody,
        TestRenderModel: options.testRenderModel,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
}

// Re-export as EmailService for channel router compatibility
export { PostmarkService as EmailService };
