import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const callSchema = z.object({
  to: z.string().min(1, "Phone number is required"),
  assistantId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  voice: z.string().optional(),
  model: z.string().optional(),
  firstMessage: z.string().optional(),
  instructions: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export async function POST(req: Request) {
  try {
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

    if (resolvedPhoneNumberId) {
      payload.phoneNumberId = resolvedPhoneNumberId;
    }

    if (resolvedAssistantId) {
      // Use the stored/provided assistant ID
      payload.assistantId = resolvedAssistantId;

      // Allow overriding specific assistant properties via assistantOverrides
      const overrides: Record<string, unknown> = {};
      if (voice) overrides.voice = { voiceId: voice };
      if (model) overrides.model = { model };
      if (firstMessage) overrides.firstMessage = firstMessage;
      if (instructions) overrides.instructions = instructions;
      if (temperature !== undefined) overrides.temperature = temperature;

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
    console.error("POST /api/test-send/call error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
