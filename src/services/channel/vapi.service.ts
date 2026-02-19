import type { Lead, Script } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type VapiConfig = {
  apiKey: string;
  baseUrl?: string;
  assistantId?: string;
  phoneNumberId?: string;
};

type VapiCallResponse = {
  id: string;
  status: string;
};

type VapiWebhookData = {
  type: string;
  call?: {
    id: string;
    status: string;
    duration?: number;
    cost?: number;
    transcript?: string;
    messages?: Array<{ role: string; content: string }>;
  };
};

async function getConfig(): Promise<VapiConfig | null> {
  const config = await prisma.integrationConfig.findUnique({
    where: { provider: "vapi" },
  });
  if (!config || !config.isActive) return null;
  try {
    const parsed = typeof config.config === "string"
      ? JSON.parse(config.config)
      : config.config;
    return parsed as VapiConfig;
  } catch {
    return null;
  }
}

type CampaignVapiConfig = {
  assistantId?: string;
  phoneNumberId?: string;
  voice?: string;
  model?: string;
  firstMessage?: string;
  instructions?: string;
  temperature?: number;
};

function parseCampaignVapiConfig(campaignMeta: unknown): CampaignVapiConfig {
  try {
    const meta = typeof campaignMeta === "string" ? JSON.parse(campaignMeta) : (campaignMeta ?? {});
    return (meta as Record<string, unknown>).vapiConfig as CampaignVapiConfig ?? {};
  } catch {
    return {};
  }
}

export class VapiService {
  static async createCall(
    lead: Lead,
    script: Script,
    campaignMeta?: unknown
  ): Promise<{ providerRef: string } | { error: string }> {
    const config = await getConfig();
    if (!config) return { error: "VAPI integration not configured or inactive" };

    const baseUrl = config.baseUrl || "https://api.vapi.ai";

    // Priority: script vapiConfig > campaign meta.vapiConfig > integration config
    const scriptOverrides: Record<string, unknown> = script.vapiConfig
      ? (typeof script.vapiConfig === "string"
          ? JSON.parse(script.vapiConfig)
          : (script.vapiConfig as Record<string, unknown>))
      : {};

    const campaignVapi = parseCampaignVapiConfig(campaignMeta);

    const phoneNumberId = scriptOverrides.phoneNumberId ?? campaignVapi.phoneNumberId ?? config.phoneNumberId;
    const assistantId = scriptOverrides.assistantId ?? campaignVapi.assistantId ?? config.assistantId;

    if (!phoneNumberId) {
      return { error: "VAPI call requires a phoneNumberId — set it in integration config, campaign, or script" };
    }

    // Merge campaign-level overrides as assistantOverrides when no script-level assistant is set
    const assistantOverrides: Record<string, unknown> = {};
    if (!scriptOverrides.assistantId && !scriptOverrides.assistant) {
      if (campaignVapi.voice) assistantOverrides.voice = campaignVapi.voice;
      if (campaignVapi.model) assistantOverrides.model = campaignVapi.model;
      if (campaignVapi.firstMessage) assistantOverrides.firstMessage = campaignVapi.firstMessage;
      if (campaignVapi.instructions) {
        assistantOverrides.instructions = campaignVapi.instructions;
      }
      if (campaignVapi.temperature !== undefined) {
        assistantOverrides.temperature = campaignVapi.temperature;
      }
    }

    const body: Record<string, unknown> = {
      ...scriptOverrides,
      assistantId,
      phoneNumberId,
      customer: {
        number: lead.phone,
        name: `${lead.firstName} ${lead.lastName}`,
      },
    };

    if (Object.keys(assistantOverrides).length > 0) {
      body.assistantOverrides = {
        ...(body.assistantOverrides as Record<string, unknown> ?? {}),
        ...assistantOverrides,
      };
    }

    const res = await fetch(`${baseUrl}/call/phone`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `VAPI API error ${res.status}: ${text}` };
    }

    const data = (await res.json()) as VapiCallResponse;
    return { providerRef: data.id };
  }

  static async getCallStatus(
    providerRef: string
  ): Promise<{ status: string; duration?: number; cost?: number } | { error: string }> {
    const config = await getConfig();
    if (!config) return { error: "VAPI integration not configured or inactive" };

    const baseUrl = config.baseUrl || "https://api.vapi.ai";

    const res = await fetch(`${baseUrl}/call/${providerRef}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    if (!res.ok) {
      return { error: `VAPI API error ${res.status}` };
    }

    const data = (await res.json()) as VapiCallResponse & {
      duration?: number;
      cost?: number;
    };
    return {
      status: data.status,
      duration: data.duration,
      cost: data.cost,
    };
  }

  static extractKeywords(transcript: string): string[] {
    const KEYWORDS = [
      "interested", "not interested", "callback", "call back",
      "busy", "wrong number", "voicemail", "appointment",
      "schedule", "price", "cost", "buy", "purchase",
      "yes", "no", "maybe", "think about it",
      "cancel", "refund", "complaint", "manager",
      "email", "send info", "more information",
    ];
    const lower = transcript.toLowerCase();
    return KEYWORDS.filter((kw) => lower.includes(kw));
  }

  static async handleCallback(data: VapiWebhookData) {
    if (!data.call?.id) return;

    const attempt = await prisma.contactAttempt.findFirst({
      where: { providerRef: data.call.id },
    });

    if (!attempt) return;

    const updateData: Record<string, unknown> = {};

    if (data.call.status === "ended" || data.call.status === "completed") {
      updateData.status = "SUCCESS";
      updateData.completedAt = new Date();
      if (data.call.duration) updateData.duration = data.call.duration;
      if (data.call.cost != null)
        updateData.cost = data.call.cost;

      const resultObj: Record<string, unknown> = {
        callId: data.call.id,
        status: data.call.status,
        duration: data.call.duration,
        cost: data.call.cost,
      };

      if (data.call.transcript) {
        resultObj.transcript = data.call.transcript;
        resultObj.keywords = this.extractKeywords(data.call.transcript);
      }

      if (data.call.messages) {
        resultObj.messages = data.call.messages;
        if (!resultObj.transcript) {
          const fullText = data.call.messages
            .map((m) => m.content)
            .join(" ");
          resultObj.keywords = this.extractKeywords(fullText);
        }
      }

      updateData.result = JSON.stringify(resultObj);
    } else if (data.call.status === "failed" || data.call.status === "no-answer") {
      updateData.status = data.call.status === "no-answer" ? "NO_ANSWER" : "FAILED";
      updateData.completedAt = new Date();
      updateData.result = JSON.stringify({
        callId: data.call.id,
        status: data.call.status,
        transcript: data.call.transcript ?? null,
      });
    } else if (data.call.status === "in-progress") {
      updateData.status = "IN_PROGRESS";
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.contactAttempt.update({
        where: { id: attempt.id },
        data: updateData,
      });
    }
  }

  static async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const config = await getConfig();
    if (!config) return { ok: false, error: "Not configured" };

    const baseUrl = config.baseUrl || "https://api.vapi.ai";
    try {
      const res = await fetch(`${baseUrl}/call`, {
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
