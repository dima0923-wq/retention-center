import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";

const callSchema = z.object({
  to: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone must be in E.164 format"),
  assistantId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  voice: z.string().optional(),
  model: z.string().optional(),
  firstMessage: z.string().optional(),
  instructions: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
    const rawBody = await req.json();
    const parsed = callSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      to,
      assistantId,
      phoneNumberId,
      voice,
      model,
      firstMessage,
      instructions,
      temperature,
    } = parsed.data;

    const config = await prisma.integrationConfig.findUnique({
      where: { provider: "vapi" },
    });

    if (!config || !config.isActive) {
      return NextResponse.json(
        { error: "VAPI integration not configured or inactive" },
        { status: 400 }
      );
    }

    const vapiConfig = JSON.parse(config.config as string) as {
      apiKey: string;
      assistantId?: string;
      phoneNumberId?: string;
    };

    const resolvedAssistantId = assistantId || vapiConfig.assistantId;
    const resolvedPhoneNumberId = phoneNumberId || vapiConfig.phoneNumberId;

    const payload: Record<string, unknown> = {
      customer: { number: to },
    };

    // Only include phoneNumberId if it's a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (resolvedPhoneNumberId && uuidRegex.test(resolvedPhoneNumberId)) {
      payload.phoneNumberId = resolvedPhoneNumberId;
    }

    if (resolvedAssistantId) {
      // Use the stored/provided assistant with optional overrides
      payload.assistantId = resolvedAssistantId;

      const overrides: Record<string, unknown> = {};
      if (voice) overrides.voice = { voiceId: voice, provider: "11labs" };
      if (model || temperature !== undefined) {
        const modelOverride: Record<string, unknown> = {};
        if (model) { modelOverride.model = model; modelOverride.provider = "openai"; }
        if (temperature !== undefined) modelOverride.temperature = temperature;
        overrides.model = modelOverride;
      }
      if (firstMessage) overrides.firstMessage = firstMessage;

      if (Object.keys(overrides).length > 0) {
        payload.assistantOverrides = overrides;
      }
    } else {
      // No assistantId — build a full assistant config inline
      const assistant: Record<string, unknown> = {};

      if (firstMessage) assistant.firstMessage = firstMessage;
      if (instructions) assistant.instructions = instructions;
      if (temperature !== undefined) assistant.temperature = temperature;

      if (model) {
        assistant.model = {
          provider: "openai",
          model: model,
        };
      }

      if (voice) {
        assistant.voice = {
          provider: "11labs",
          voiceId: voice,
        };
      }

      payload.assistant = assistant;
    }

    const res = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vapiConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "VAPI API error", details: text },
        { status: res.status }
      );
    }

    const data = (await res.json()) as { id: string; status: string };
    return NextResponse.json({ callId: data.id, status: data.status });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/test-send/call error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
