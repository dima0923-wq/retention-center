import type { Lead, Script } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type EmailConfig = {
  apiUrl: string;
  apiKey: string;
  fromEmail: string;
  fromName?: string;
};

type EmailWebhookData = {
  messageId: string;
  event: string;
  timestamp?: string;
};

function replaceVariables(template: string, lead: Lead): string {
  return template
    .replace(/\{\{firstName\}\}/g, lead.firstName)
    .replace(/\{\{lastName\}\}/g, lead.lastName)
    .replace(/\{\{phone\}\}/g, lead.phone ?? "")
    .replace(/\{\{email\}\}/g, lead.email ?? "");
}

async function getConfig(): Promise<EmailConfig | null> {
  const config = await prisma.integrationConfig.findUnique({
    where: { provider: "email" },
  });
  if (!config || !config.isActive) return null;
  return config.config as unknown as EmailConfig;
}

export class EmailService {
  static async sendEmail(
    lead: Lead,
    script: Script
  ): Promise<{ providerRef: string } | { error: string }> {
    const config = await getConfig();
    if (!config) return { error: "Email integration not configured or inactive" };

    if (!lead.email) return { error: "Lead has no email address" };

    const content = script.content ? replaceVariables(script.content, lead) : "";

    const res = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: {
          email: config.fromEmail,
          name: config.fromName ?? "Retention Center",
        },
        to: [{ email: lead.email, name: `${lead.firstName} ${lead.lastName}` }],
        subject: script.name,
        html: content,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Email API error ${res.status}: ${text}` };
    }

    const data = (await res.json()) as { id?: string; messageId?: string };
    return { providerRef: data.id ?? data.messageId ?? "" };
  }

  static async getDeliveryStatus(
    providerRef: string
  ): Promise<{ status: string } | { error: string }> {
    const config = await getConfig();
    if (!config) return { error: "Email integration not configured or inactive" };

    const url = new URL(config.apiUrl);
    const res = await fetch(`${url.origin}/messages/${providerRef}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    if (!res.ok) return { error: `Email API error ${res.status}` };

    const data = (await res.json()) as { status: string };
    return { status: data.status };
  }

  static async handleCallback(data: EmailWebhookData) {
    if (!data.messageId) return;

    const attempt = await prisma.contactAttempt.findFirst({
      where: { providerRef: data.messageId },
    });

    if (!attempt) return;

    const eventMap: Record<string, string> = {
      delivered: "SUCCESS",
      sent: "IN_PROGRESS",
      opened: "SUCCESS",
      clicked: "SUCCESS",
      bounced: "FAILED",
      failed: "FAILED",
      rejected: "FAILED",
    };

    const newStatus = eventMap[data.event] ?? "IN_PROGRESS";

    await prisma.contactAttempt.update({
      where: { id: attempt.id },
      data: {
        status: newStatus as "SUCCESS" | "FAILED" | "IN_PROGRESS",
        completedAt: ["SUCCESS", "FAILED"].includes(newStatus)
          ? new Date()
          : undefined,
        result: JSON.parse(JSON.stringify(data)),
      },
    });
  }

  static async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const config = await getConfig();
    if (!config) return { ok: false, error: "Not configured" };

    try {
      const res = await fetch(config.apiUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      return res.ok
        ? { ok: true }
        : { ok: false, error: `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
