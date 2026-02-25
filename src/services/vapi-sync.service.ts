import { prisma } from "@/lib/db";

type VapiApiCall = {
  id: string;
  type?: string;
  status?: string;
  assistantId?: string;
  phoneNumberId?: string;
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  cost?: number;
  costBreakdown?: Record<string, number>;
  endedReason?: string;
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  customer?: { number?: string; name?: string };
  artifact?: {
    transcript?: string;
    messages?: Array<{ role: string; content: string }>;
    recordingUrl?: string;
    stereoRecordingUrl?: string;
  };
  analysis?: {
    summary?: string;
    successEvaluation?: string;
    structuredData?: Record<string, unknown>;
  };
};

function mapCallData(call: VapiApiCall) {
  return {
    type: call.type ?? null,
    status: call.status ?? "unknown",
    assistantId: call.assistantId ?? null,
    phoneNumberId: call.phoneNumberId ?? null,
    customerNumber: call.customer?.number ?? null,
    customerName: call.customer?.name ?? null,
    startedAt: call.startedAt ? new Date(call.startedAt) : null,
    endedAt: call.endedAt ? new Date(call.endedAt) : null,
    duration: call.duration ?? null,
    cost: call.cost ?? null,
    costBreakdown: call.costBreakdown ? JSON.stringify(call.costBreakdown) : "{}",
    transcript: call.artifact?.transcript ?? null,
    messages: call.artifact?.messages ? JSON.stringify(call.artifact.messages) : "[]",
    recordingUrl: call.artifact?.recordingUrl ?? call.recordingUrl ?? null,
    stereoRecordingUrl: call.artifact?.stereoRecordingUrl ?? call.stereoRecordingUrl ?? null,
    summary: call.analysis?.summary ?? null,
    successEvaluation: call.analysis?.successEvaluation ?? null,
    structuredData: call.analysis?.structuredData ? JSON.stringify(call.analysis.structuredData) : "{}",
    endedReason: call.endedReason ?? null,
    contactAttemptId: null as string | null,
  };
}

export class VapiSyncService {
  static async syncCalls(): Promise<{ synced: number; total: number }> {
    const integration = await prisma.integrationConfig.findUnique({
      where: { provider: "vapi" },
    });

    if (!integration || !integration.isActive) {
      return { synced: 0, total: 0 };
    }

    let apiKey: string;
    try {
      const parsed = typeof integration.config === "string"
        ? JSON.parse(integration.config)
        : integration.config;
      apiKey = (parsed as { apiKey: string }).apiKey;
    } catch {
      return { synced: 0, total: 0 };
    }

    if (!apiKey) return { synced: 0, total: 0 };

    const lastCall = await prisma.vapiCall.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const since = lastCall
      ? lastCall.createdAt
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const url = new URL("https://api.vapi.ai/call");
    url.searchParams.set("limit", "100");
    url.searchParams.set("createdAtGt", since.toISOString());

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) return { synced: 0, total: 0 };

    const calls = (await res.json()) as VapiApiCall[];
    let synced = 0;

    for (const call of calls) {
      const data = mapCallData(call);

      const attempt = await prisma.contactAttempt.findFirst({
        where: { providerRef: call.id },
        select: { id: true },
      });
      if (attempt) data.contactAttemptId = attempt.id;

      await prisma.vapiCall.upsert({
        where: { vapiCallId: call.id },
        create: { vapiCallId: call.id, ...data },
        update: data,
      });
      synced++;
    }

    // Second pass: re-sync calls stuck in non-terminal statuses
    const pendingCalls = await prisma.vapiCall.findMany({
      where: {
        status: { in: ["ringing", "in-progress", "queued", "scheduled"] },
      },
      select: { vapiCallId: true },
      take: 50,
    });

    for (const pending of pendingCalls) {
      try {
        const callRes = await fetch(
          `https://api.vapi.ai/call/${pending.vapiCallId}`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        if (!callRes.ok) continue;

        const callData = (await callRes.json()) as VapiApiCall;
        const mapped = mapCallData(callData);

        const attempt = await prisma.contactAttempt.findFirst({
          where: { providerRef: pending.vapiCallId },
          select: { id: true },
        });
        if (attempt) mapped.contactAttemptId = attempt.id;

        await prisma.vapiCall.update({
          where: { vapiCallId: pending.vapiCallId },
          data: mapped,
        });
        synced++;
      } catch {
        // Skip individual call failures
      }
    }

    return { synced, total: calls.length + pendingCalls.length };
  }
}
