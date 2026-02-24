import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, "retention:analytics:view");

    // Get VAPI API key from IntegrationConfig
    const integration = await prisma.integrationConfig.findUnique({
      where: { provider: "vapi" },
    });

    if (!integration || !integration.isActive) {
      return NextResponse.json(
        { error: "VAPI integration not configured or inactive" },
        { status: 400 }
      );
    }

    let apiKey: string;
    try {
      const parsed = typeof integration.config === "string"
        ? JSON.parse(integration.config)
        : integration.config;
      apiKey = (parsed as { apiKey: string }).apiKey;
    } catch {
      return NextResponse.json(
        { error: "Invalid VAPI integration config" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "VAPI API key not found in integration config" },
        { status: 400 }
      );
    }

    // Determine sync start time: last synced call or 24h ago
    const lastCall = await prisma.vapiCall.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const since = lastCall
      ? lastCall.createdAt
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch calls from VAPI API
    const url = new URL("https://api.vapi.ai/call");
    url.searchParams.set("limit", "100");
    url.searchParams.set("createdAtGt", since.toISOString());

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `VAPI API error ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    const calls = await res.json() as VapiApiCall[];
    let synced = 0;

    for (const call of calls) {
      const data = mapCallData(call);

      // Try to match with ContactAttempt
      if (!data.contactAttemptId) {
        const attempt = await prisma.contactAttempt.findFirst({
          where: { providerRef: call.id },
          select: { id: true },
        });
        if (attempt) {
          data.contactAttemptId = attempt.id;
        }
      }

      await prisma.vapiCall.upsert({
        where: { vapiCallId: call.id },
        create: { vapiCallId: call.id, ...data },
        update: data,
      });
      synced++;
    }

    return NextResponse.json({ synced, total: calls.length });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to sync VAPI calls:", error);
    return NextResponse.json(
      { error: "Failed to sync VAPI calls" },
      { status: 500 }
    );
  }
}

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
