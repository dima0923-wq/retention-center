import crypto from "crypto";
import { prisma } from "@/lib/db";
import type { Lead } from "@/generated/prisma/client";

type MetaCapiConfig = {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
};

type ConversionEventData = {
  eventName: string;
  eventTime?: number;
  actionSource: "website" | "system_generated";
  userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    externalId?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
    fbc?: string;
    fbp?: string;
  };
  customData?: {
    currency?: string;
    value?: number;
    contentName?: string;
    contentCategory?: string;
    status?: string;
  };
  eventSourceUrl?: string;
  eventId?: string;
};

function hashSHA256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

async function getConfig(): Promise<MetaCapiConfig | null> {
  const config = await prisma.integrationConfig.findUnique({
    where: { provider: "meta_capi" },
  });
  if (!config || !config.isActive) return null;
  return JSON.parse(config.config as string) as MetaCapiConfig;
}

export class MetaCapiService {
  static async sendEvent(event: ConversionEventData): Promise<{ success: boolean; error?: string }> {
    const config = await getConfig();
    if (!config) return { success: false, error: "Meta CAPI not configured" };

    const userData: Record<string, string> = {};
    if (event.userData.email) userData.em = hashSHA256(event.userData.email);
    if (event.userData.phone) userData.ph = hashSHA256(event.userData.phone.replace(/\D/g, ""));
    if (event.userData.firstName) userData.fn = hashSHA256(event.userData.firstName);
    if (event.userData.lastName) userData.ln = hashSHA256(event.userData.lastName);
    if (event.userData.externalId) userData.external_id = hashSHA256(event.userData.externalId);
    if (event.userData.clientIpAddress) userData.client_ip_address = event.userData.clientIpAddress;
    if (event.userData.clientUserAgent) userData.client_user_agent = event.userData.clientUserAgent;
    if (event.userData.fbc) userData.fbc = event.userData.fbc;
    if (event.userData.fbp) userData.fbp = event.userData.fbp;

    const payload: Record<string, unknown> = {
      data: [{
        event_name: event.eventName,
        event_time: event.eventTime || Math.floor(Date.now() / 1000),
        action_source: event.actionSource,
        user_data: userData,
        custom_data: event.customData,
        event_source_url: event.eventSourceUrl,
        event_id: event.eventId,
      }],
    };

    if (config.testEventCode) {
      payload.test_event_code = config.testEventCode;
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${config.pixelId}/events?access_token=${config.accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `Meta CAPI error ${res.status}: ${text}` };
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  static async sendLeadEvent(lead: Lead, options?: { eventSourceUrl?: string; fbc?: string; fbp?: string }) {
    return this.sendEvent({
      eventName: "Lead",
      actionSource: "system_generated",
      userData: {
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        firstName: lead.firstName,
        lastName: lead.lastName,
        externalId: lead.id,
        fbc: options?.fbc,
        fbp: options?.fbp,
      },
      eventSourceUrl: options?.eventSourceUrl,
      eventId: `lead_${lead.id}`,
    });
  }

  static async sendConversionEvent(lead: Lead, revenue: number, conversionId: string) {
    return this.sendEvent({
      eventName: "Purchase",
      actionSource: "system_generated",
      userData: {
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        firstName: lead.firstName,
        lastName: lead.lastName,
        externalId: lead.id,
      },
      customData: {
        currency: "USD",
        value: revenue,
        status: "converted",
      },
      eventId: `conversion_${conversionId}`,
    });
  }

  static async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const config = await getConfig();
    if (!config) return { ok: false, error: "Not configured" };
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${config.pixelId}?fields=name&access_token=${config.accessToken}`
      );
      if (res.ok) return { ok: true };
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
