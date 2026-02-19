import type { Lead, Script } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export interface SmsProvider {
  sendSms(
    phone: string,
    text: string,
    options?: Record<string, string>
  ): Promise<{ providerRef: string; success: boolean; error?: string }>;
  getStatus(
    providerRef: string
  ): Promise<{ status: string }>;
  testConnection(): Promise<{
    success: boolean;
    balance?: number;
    error?: string;
  }>;
}

type SmsRetailConfig = {
  provider: "sms-retail";
  apiKey: string;
  channelType: string;
};

const TELECOM_API_URL = "https://23telecomrestapi.com/sms/api?";

type TelecomConfig = {
  provider: "23telecom";
  apiUrl?: string;
  username: string;
  password: string;
  ani?: string;
  senderId?: string;
  serviceType?: string;
};

type SmsConfigUnion = SmsRetailConfig | TelecomConfig;

function stripPlus(phone: string): string {
  return phone.startsWith("+") ? phone.slice(1) : phone;
}

export class SmsRetailProvider implements SmsProvider {
  private apiKey: string;
  private channelType: string;
  private baseUrl = "https://sms-retail.io";

  constructor(config: SmsRetailConfig) {
    this.apiKey = config.apiKey;
    this.channelType = config.channelType || "whatsapp";
  }

  async sendSms(
    phone: string,
    text: string
  ): Promise<{ providerRef: string; success: boolean; error?: string }> {
    const res = await fetch(`${this.baseUrl}/ext/api/v1/messages/send`, {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { phone: stripPlus(phone), text, type: this.channelType },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { providerRef: "", success: false, error: `HTTP ${res.status}: ${errText}` };
    }

    const data = (await res.json()) as {
      success: boolean;
      messages?: { id: number; phone: string }[];
    };

    if (!data.success || !data.messages?.length) {
      return { providerRef: "", success: false, error: "No message ID returned" };
    }

    return { providerRef: String(data.messages[0].id), success: true };
  }

  async getStatus(providerRef: string): Promise<{ status: string }> {
    const res = await fetch(`${this.baseUrl}/ext/api/v1/messages/status`, {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: [Number(providerRef)] }),
    });

    if (!res.ok) {
      return { status: "unknown" };
    }

    const data = (await res.json()) as {
      success: boolean;
      info?: { id: number; status: string }[];
    };

    if (!data.success || !data.info?.length) {
      return { status: "unknown" };
    }

    return { status: data.info[0].status };
  }

  async testConnection(): Promise<{
    success: boolean;
    balance?: number;
    error?: string;
  }> {
    try {
      const res = await fetch(`${this.baseUrl}/ext/api/v1/balance`, {
        method: "POST",
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }

      const data = (await res.json()) as {
        success: boolean;
        balance?: number;
        currency?: string;
      };

      return data.success
        ? { success: true, balance: data.balance }
        : { success: false, error: "API returned success: false" };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
}

export class TelecomProvider implements SmsProvider {
  private apiUrl: string;
  private username: string;
  private password: string;
  private ani: string;
  private serviceType: string;

  constructor(config: TelecomConfig) {
    this.apiUrl = config.apiUrl || TELECOM_API_URL;
    this.username = config.username;
    this.password = config.password;
    this.ani = config.ani || config.senderId || "";
    this.serviceType = config.serviceType ?? "";
  }

  private buildUrl(params: Record<string, string>): string {
    const base = this.apiUrl.endsWith("?")
      ? this.apiUrl
      : this.apiUrl + "?";
    const query = new URLSearchParams({
      username: this.username,
      password: this.password,
      ...params,
    });
    return base + query.toString();
  }

  async sendSms(
    phone: string,
    text: string
  ): Promise<{ providerRef: string; success: boolean; error?: string }> {
    const url = this.buildUrl({
      ani: this.ani,
      dnis: stripPlus(phone),
      message: text,
      command: "submit",
      serviceType: this.serviceType,
      longMessageMode: "cut",
    });

    const res = await fetch(url, { method: "GET" });

    if (!res.ok) {
      const errText = await res.text();
      return { providerRef: "", success: false, error: errText || `HTTP ${res.status}` };
    }

    const data = (await res.json()) as { message_id?: string };

    if (!data.message_id) {
      return { providerRef: "", success: false, error: "No message_id returned" };
    }

    return { providerRef: data.message_id, success: true };
  }

  async getStatus(providerRef: string): Promise<{ status: string }> {
    const url = this.buildUrl({
      messageId: providerRef,
      command: "query",
    });

    const res = await fetch(url, { method: "GET" });

    if (!res.ok) {
      return { status: "unknown" };
    }

    const data = (await res.json()) as { status?: string };
    return { status: data.status ?? "unknown" };
  }

  async testConnection(): Promise<{
    success: boolean;
    balance?: number;
    error?: string;
  }> {
    if (!this.username || !this.password) {
      return { success: false, error: "Missing required config fields" };
    }
    return { success: true };
  }
}

function buildSmsConfig(integrationConfig: { provider: string; config: unknown }): SmsConfigUnion {
  const raw = (typeof integrationConfig.config === "string"
    ? JSON.parse(integrationConfig.config)
    : integrationConfig.config) as Record<string, unknown>;
  return { provider: integrationConfig.provider, ...raw } as unknown as SmsConfigUnion;
}

export function createSmsProvider(config: SmsConfigUnion): SmsProvider {
  switch (config.provider) {
    case "sms-retail":
      return new SmsRetailProvider(config);
    case "23telecom":
      return new TelecomProvider(config);
    default:
      throw new Error(`Unknown SMS provider: ${(config as { provider: string }).provider}`);
  }
}

function replaceVariables(template: string, lead: Lead): string {
  return template
    .replace(/\{\{firstName\}\}/g, lead.firstName)
    .replace(/\{\{lastName\}\}/g, lead.lastName)
    .replace(/\{\{phone\}\}/g, lead.phone ?? "")
    .replace(/\{\{email\}\}/g, lead.email ?? "");
}

export async function sendSmsToLead(
  leadId: string,
  message: string,
  scriptId?: string
): Promise<{ attemptId: string; providerRef: string } | { error: string }> {
  const integrationConfig = await prisma.integrationConfig.findFirst({
    where: { type: "SMS", isActive: true },
  });

  if (!integrationConfig) {
    return { error: "No active SMS integration configured" };
  }

  const smsConfig = buildSmsConfig(integrationConfig);
  const provider = createSmsProvider(smsConfig);

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "Lead not found" };
  if (!lead.phone) return { error: "Lead has no phone number" };

  const attempt = await prisma.contactAttempt.create({
    data: {
      leadId: lead.id,
      channel: "SMS",
      status: "PENDING",
      scriptId: scriptId ?? undefined,
      provider: smsConfig.provider,
    },
  });

  const result = await provider.sendSms(lead.phone, message);

  if (!result.success) {
    await prisma.contactAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        notes: result.error,
      },
    });
    return { error: result.error ?? "Send failed" };
  }

  await prisma.contactAttempt.update({
    where: { id: attempt.id },
    data: {
      providerRef: result.providerRef,
      status: "IN_PROGRESS",
    },
  });

  return { attemptId: attempt.id, providerRef: result.providerRef };
}

// SmsService class used by channel-router (no attempt creation) and webhook handling
export class SmsService {
  /**
   * Send SMS using active provider. Does NOT create a ContactAttempt —
   * the caller (channel-router) is responsible for attempt lifecycle.
   */
  static async sendSms(
    lead: Lead,
    script: Script
  ): Promise<{ providerRef: string } | { error: string }> {
    const integrationConfig = await prisma.integrationConfig.findFirst({
      where: { type: "SMS", isActive: true },
    });
    if (!integrationConfig) return { error: "No active SMS integration configured" };

    const smsConfig = buildSmsConfig(integrationConfig);
    const provider = createSmsProvider(smsConfig);

    if (!lead.phone) return { error: "Lead has no phone number" };

    const text = script.content ? replaceVariables(script.content, lead) : "";
    const result = await provider.sendSms(lead.phone, text);

    if (!result.success) return { error: result.error ?? "Send failed" };
    return { providerRef: result.providerRef };
  }

  static async getDeliveryStatus(
    providerRef: string
  ): Promise<{ status: string } | { error: string }> {
    const integrationConfig = await prisma.integrationConfig.findFirst({
      where: { type: "SMS", isActive: true },
    });
    if (!integrationConfig) return { error: "No active SMS integration" };

    const smsConfig = buildSmsConfig(integrationConfig);
    const provider = createSmsProvider(smsConfig);
    return provider.getStatus(providerRef);
  }

  static async handleCallback(data: {
    messageId?: string;
    id?: number;
    status: string;
  }) {
    const ref = data.messageId ?? (data.id != null ? String(data.id) : null);
    if (!ref) return;

    const attempt = await prisma.contactAttempt.findFirst({
      where: { providerRef: ref },
    });
    if (!attempt) return;

    const statusMap: Record<string, string> = {
      delivered: "SUCCESS",
      DELIVRD: "SUCCESS",
      sent: "IN_PROGRESS",
      failed: "FAILED",
      UNDELIV: "FAILED",
      undelivered: "FAILED",
    };

    const newStatus = statusMap[data.status] ?? "IN_PROGRESS";

    await prisma.contactAttempt.update({
      where: { id: attempt.id },
      data: {
        status: newStatus as "SUCCESS" | "FAILED" | "IN_PROGRESS",
        completedAt: ["SUCCESS", "FAILED"].includes(newStatus)
          ? new Date()
          : undefined,
        result: JSON.stringify(data),
      },
    });
  }

  static async testConnection(): Promise<{ ok: boolean; error?: string; balance?: number }> {
    const integrationConfig = await prisma.integrationConfig.findFirst({
      where: { type: "SMS", isActive: true },
    });
    if (!integrationConfig) return { ok: false, error: "Not configured" };

    try {
      const smsConfig = buildSmsConfig(integrationConfig);
      const provider = createSmsProvider(smsConfig);
      const result = await provider.testConnection();
      return { ok: result.success, error: result.error, balance: result.balance };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
