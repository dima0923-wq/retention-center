import type { Lead, Script } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const INSTANTLY_BASE = "https://api.instantly.ai/api/v2";

type InstantlyConfig = {
  apiKey: string;
  defaultCampaignId?: string;
};

type InstantlyLead = {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone?: string;
  custom_variables?: Record<string, string>;
};

type InstantlyWebhookData = {
  event_type: string;
  campaign_id?: string;
  lead_email?: string;
  email_account?: string;
  timestamp?: string;
  [key: string]: unknown;
};

function replaceVariables(template: string, lead: Lead): string {
  return template
    .replace(/\{\{firstName\}\}/g, lead.firstName)
    .replace(/\{\{lastName\}\}/g, lead.lastName)
    .replace(/\{\{phone\}\}/g, lead.phone ?? "")
    .replace(/\{\{email\}\}/g, lead.email ?? "");
}

async function getConfig(): Promise<InstantlyConfig | null> {
  const config = await prisma.integrationConfig.findUnique({
    where: { provider: "instantly" },
  });
  if (!config || !config.isActive) return null;
  const raw = config.config as string;
  return JSON.parse(raw) as InstantlyConfig;
}

async function instantlyFetch(
  path: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${INSTANTLY_BASE}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

export class InstantlyService {
  // ── Campaign Management ──────────────────────────────────

  static async createCampaign(
    name: string,
    campaignConfig?: Record<string, unknown>
  ) {
    const config = await getConfig();
    if (!config) return { error: "Instantly integration not configured or inactive" };

    const res = await instantlyFetch("/campaigns", config.apiKey, {
      method: "POST",
      body: JSON.stringify({ name, ...campaignConfig }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return res.json();
  }

  static async listCampaigns(limit = 10, skip = 0, status?: string) {
    const config = await getConfig();
    if (!config) return { error: "Instantly integration not configured or inactive" };

    const params = new URLSearchParams({
      limit: String(limit),
      skip: String(skip),
    });
    if (status) params.set("status", status);

    const res = await instantlyFetch(`/campaigns?${params}`, config.apiKey);

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return res.json();
  }

  static async getCampaign(campaignId: string) {
    const config = await getConfig();
    if (!config) return { error: "Instantly integration not configured or inactive" };

    const res = await instantlyFetch(`/campaigns/${campaignId}`, config.apiKey);

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return res.json();
  }

  static async launchCampaign(campaignId: string) {
    const config = await getConfig();
    if (!config) return { error: "Instantly integration not configured or inactive" };

    const res = await instantlyFetch(`/campaigns/${campaignId}/launch`, config.apiKey, {
      method: "POST",
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return res.json();
  }

  static async pauseCampaign(campaignId: string) {
    const config = await getConfig();
    if (!config) return { error: "Instantly integration not configured or inactive" };

    const res = await instantlyFetch(`/campaigns/${campaignId}/pause`, config.apiKey, {
      method: "POST",
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return res.json();
  }

  // ── Lead Management ──────────────────────────────────────

  static async addLead(campaignId: string, lead: InstantlyLead) {
    const config = await getConfig();
    if (!config) return { error: "Instantly integration not configured or inactive" };

    const res = await instantlyFetch("/leads", config.apiKey, {
      method: "POST",
      body: JSON.stringify({
        campaign_id: campaignId,
        ...lead,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return res.json();
  }

  static async addLeadsBulk(campaignId: string, leads: InstantlyLead[]) {
    const config = await getConfig();
    if (!config) return { error: "Instantly integration not configured or inactive" };

    const res = await instantlyFetch("/leads/bulk", config.apiKey, {
      method: "POST",
      body: JSON.stringify({
        campaign_id: campaignId,
        leads,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return res.json();
  }

  static async listLeads(campaignId: string, limit = 10, skip = 0) {
    const config = await getConfig();
    if (!config) return { error: "Instantly integration not configured or inactive" };

    const res = await instantlyFetch("/leads/list", config.apiKey, {
      method: "POST",
      body: JSON.stringify({
        campaign_id: campaignId,
        limit,
        skip,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return res.json();
  }

  // ── Accounts ─────────────────────────────────────────────

  static async listAccounts() {
    const config = await getConfig();
    if (!config) return { error: "Instantly integration not configured or inactive" };

    const res = await instantlyFetch("/accounts", config.apiKey);

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return res.json();
  }

  // ── Webhooks ─────────────────────────────────────────────

  static async subscribeWebhook(eventType: string, webhookUrl: string) {
    const config = await getConfig();
    if (!config) return { error: "Instantly integration not configured or inactive" };

    const res = await instantlyFetch("/webhooks", config.apiKey, {
      method: "POST",
      body: JSON.stringify({
        event_type: eventType,
        webhook_url: webhookUrl,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return res.json();
  }

  static async listWebhooks() {
    const config = await getConfig();
    if (!config) return { error: "Instantly integration not configured or inactive" };

    const res = await instantlyFetch("/webhooks", config.apiKey);

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return res.json();
  }

  // ── Analytics ────────────────────────────────────────────

  static async getCampaignAnalytics(
    campaignId: string,
    startDate?: string,
    endDate?: string
  ) {
    const config = await getConfig();
    if (!config) return { error: "Instantly integration not configured or inactive" };

    const params = new URLSearchParams({ campaign_id: campaignId });
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    const res = await instantlyFetch(
      `/analytics/campaign/overview?${params}`,
      config.apiKey
    );

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    return res.json();
  }

  // ── Webhook Handler ──────────────────────────────────────

  static async handleWebhookEvent(data: InstantlyWebhookData) {
    if (!data.event_type || !data.lead_email) return;

    // Find contact attempt by lead email + campaign
    const attempt = await prisma.contactAttempt.findFirst({
      where: {
        channel: "EMAIL",
        lead: { email: data.lead_email },
        ...(data.campaign_id ? { providerRef: data.campaign_id } : {}),
      },
      orderBy: { startedAt: "desc" },
    });

    if (!attempt) return;

    const eventMap: Record<string, string> = {
      email_sent: "IN_PROGRESS",
      email_opened: "SUCCESS",
      reply_received: "SUCCESS",
      auto_reply_received: "SUCCESS",
      link_clicked: "SUCCESS",
      email_bounced: "FAILED",
      lead_unsubscribed: "FAILED",
      account_error: "FAILED",
      campaign_completed: "SUCCESS",
    };

    const newStatus = eventMap[data.event_type] ?? "IN_PROGRESS";

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

  // ── Connection Test ──────────────────────────────────────

  static async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const config = await getConfig();
    if (!config) return { ok: false, error: "Not configured" };

    try {
      const res = await instantlyFetch("/campaigns?limit=1", config.apiKey);
      return res.ok
        ? { ok: true }
        : { ok: false, error: `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  // ── Channel Router Compatible ────────────────────────────

  static async sendEmail(
    lead: Lead,
    script: Script
  ): Promise<{ providerRef: string } | { error: string }> {
    const config = await getConfig();
    if (!config) return { error: "Instantly integration not configured or inactive" };

    if (!lead.email) return { error: "Lead has no email address" };

    const campaignId = config.defaultCampaignId;
    if (!campaignId) return { error: "No default campaign ID configured for Instantly" };

    const content = script.content ? replaceVariables(script.content, lead) : "";

    const res = await instantlyFetch("/leads", config.apiKey, {
      method: "POST",
      body: JSON.stringify({
        campaign_id: campaignId,
        email: lead.email,
        first_name: lead.firstName,
        last_name: lead.lastName,
        phone: lead.phone ?? undefined,
        custom_variables: {
          subject: script.name,
          body: content,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Instantly API error ${res.status}: ${text}` };
    }

    const result = (await res.json()) as { id?: string };
    return { providerRef: result.id ?? campaignId };
  }
}

// Re-export as EmailService for backward compatibility with channel-router
export { InstantlyService as EmailService };
