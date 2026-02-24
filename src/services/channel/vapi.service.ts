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

// Comprehensive VAPI webhook payload types
type VapiCallData = {
  id: string;
  status: string;
  duration?: number;
  cost?: number;
  transcript?: string;
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  endedReason?: string;
  messages?: Array<{ role: string; content: string }>;
  analysis?: {
    summary?: string;
    successEvaluation?: string;
    structuredData?: Record<string, unknown>;
  };
  customer?: {
    number?: string;
    name?: string;
  };
};

export type VapiWebhookPayload = {
  type: string;
  call?: VapiCallData;
  timestamp?: string;
  artifact?: {
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    transcript?: string;
    messages?: Array<{ role: string; content: string }>;
  };
  // speech-update fields
  role?: string;
  status?: string; // "started" | "stopped"
  // transcript fields
  transcriptType?: string; // "partial" | "final"
  transcript?: string;
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

  /**
   * Fetch call recording URL from VAPI API for a given call.
   */
  static async getCallRecording(
    providerRef: string
  ): Promise<{ recordingUrl: string | null; stereoRecordingUrl: string | null } | { error: string }> {
    const config = await getConfig();
    if (!config) return { error: "VAPI integration not configured or inactive" };

    const baseUrl = config.baseUrl || "https://api.vapi.ai";

    const res = await fetch(`${baseUrl}/call/${providerRef}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    if (!res.ok) {
      return { error: `VAPI API error ${res.status}` };
    }

    const data = (await res.json()) as {
      recordingUrl?: string;
      stereoRecordingUrl?: string;
    };

    return {
      recordingUrl: data.recordingUrl ?? null,
      stereoRecordingUrl: data.stereoRecordingUrl ?? null,
    };
  }

  static extractKeywords(transcript: string): string[] {
    const KEYWORDS = [
      // Positive intent
      "interested", "yes", "sure", "absolutely", "definitely",
      "buy", "purchase", "sign up", "sign me up", "deal",
      "appointment", "schedule", "book", "meeting",
      "agree", "sounds good", "let's do it", "go ahead",
      // Negative intent
      "not interested", "no thanks", "no thank you", "don't call",
      "remove me", "stop calling", "do not call", "unsubscribe",
      "cancel", "refund", "complaint",
      // Neutral / deferral
      "callback", "call back", "call me back", "later",
      "busy", "bad time", "not now", "think about it", "maybe",
      "send info", "send information", "more information", "email me",
      "send email", "send details",
      // Objections
      "too expensive", "price", "cost", "discount", "cheaper",
      "already have", "not needed", "don't need",
      // Disposition
      "wrong number", "voicemail", "no answer", "hung up",
      "manager", "supervisor", "speak to someone",
      // Positive outcome
      "deposit", "payment", "credit card", "pay now",
      "thank you", "thanks",
    ];
    const lower = transcript.toLowerCase();
    return KEYWORDS.filter((kw) => lower.includes(kw));
  }

  /**
   * Classify call outcome based on extracted keywords.
   */
  static classifyOutcome(keywords: string[]): string {
    const set = new Set(keywords);
    if (set.has("deposit") || set.has("payment") || set.has("credit card") || set.has("pay now")) {
      return "converted";
    }
    if (set.has("interested") || set.has("yes") || set.has("absolutely") || set.has("sign up") || set.has("appointment") || set.has("book")) {
      return "interested";
    }
    if (set.has("callback") || set.has("call back") || set.has("call me back") || set.has("think about it") || set.has("maybe") || set.has("send info")) {
      return "callback";
    }
    if (set.has("not interested") || set.has("no thanks") || set.has("don't call") || set.has("remove me") || set.has("stop calling")) {
      return "not_interested";
    }
    if (set.has("wrong number")) return "wrong_number";
    if (set.has("voicemail")) return "voicemail";
    return "unknown";
  }

  static async handleCallback(data: VapiWebhookPayload) {
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
        endedReason: data.call.endedReason ?? null,
      };

      // Store recording URLs
      const recordingUrl = data.call.recordingUrl ?? data.artifact?.recordingUrl ?? null;
      const stereoRecordingUrl = data.call.stereoRecordingUrl ?? data.artifact?.stereoRecordingUrl ?? null;
      if (recordingUrl) resultObj.recordingUrl = recordingUrl;
      if (stereoRecordingUrl) resultObj.stereoRecordingUrl = stereoRecordingUrl;

      // Store analysis if provided
      if (data.call.analysis) {
        resultObj.analysis = data.call.analysis;
      }

      // Use transcript from call data or artifact
      const transcript = data.call.transcript ?? data.artifact?.transcript ?? null;
      const messages = data.call.messages ?? data.artifact?.messages ?? null;

      if (transcript) {
        resultObj.transcript = transcript;
        const keywords = this.extractKeywords(transcript);
        resultObj.keywords = keywords;
        resultObj.outcome = this.classifyOutcome(keywords);
      }

      if (messages) {
        resultObj.messages = messages;
        if (!transcript) {
          const fullText = messages.map((m) => m.content).join(" ");
          const keywords = this.extractKeywords(fullText);
          resultObj.keywords = keywords;
          resultObj.outcome = this.classifyOutcome(keywords);
        }
      }

      updateData.result = JSON.stringify(resultObj);
    } else if (data.call.status === "failed" || data.call.status === "no-answer") {
      updateData.status = "FAILED";
      updateData.completedAt = new Date();
      const existingResult = attempt.result ? JSON.parse(attempt.result as string) : {};
      const resultObj: Record<string, unknown> = {
        ...existingResult,
        callId: data.call.id,
        status: data.call.status,
        endedReason: data.call.endedReason ?? null,
        transcript: data.call.transcript ?? null,
      };
      if (data.call.status === "no-answer") {
        resultObj.reason = "no_answer";
      }
      if (data.call.status === "failed") {
        resultObj.reason = data.call.endedReason ?? "unknown";
      }
      updateData.result = JSON.stringify(resultObj);
    } else if (data.call.status === "in-progress" || data.call.status === "ringing") {
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
