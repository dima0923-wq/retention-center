import type { Lead, Script } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type VapiConfig = {
  apiKey: string;
  baseUrl?: string;
  assistantId?: string;
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
  };
};

async function getConfig(): Promise<VapiConfig | null> {
  const config = await prisma.integrationConfig.findUnique({
    where: { provider: "vapi" },
  });
  if (!config || !config.isActive) return null;
  return config.config as unknown as VapiConfig;
}

export class VapiService {
  static async createCall(
    lead: Lead,
    script: Script
  ): Promise<{ providerRef: string } | { error: string }> {
    const config = await getConfig();
    if (!config) return { error: "VAPI integration not configured or inactive" };

    const baseUrl = config.baseUrl || "https://api.vapi.ai";

    const body: Record<string, unknown> = {
      assistantId: config.assistantId,
      customer: {
        number: lead.phone,
        name: `${lead.firstName} ${lead.lastName}`,
      },
    };

    if (script.vapiConfig) {
      Object.assign(body, script.vapiConfig);
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
      updateData.result = data.call;
    } else if (data.call.status === "failed" || data.call.status === "no-answer") {
      updateData.status = data.call.status === "no-answer" ? "NO_ANSWER" : "FAILED";
      updateData.completedAt = new Date();
      updateData.result = data.call;
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
