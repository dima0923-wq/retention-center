import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    await verifyApiAuth(req);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  const body = await req.json();
  const { phoneNumber, assistantId, phoneNumberId } = body as {
    phoneNumber: string;
    assistantId?: string;
    phoneNumberId?: string;
  };

  if (!phoneNumber) {
    return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
  }

  const config = await prisma.integrationConfig.findUnique({ where: { provider: "vapi" } });
  if (!config || !config.isActive) {
    return NextResponse.json({ error: "VAPI not configured" }, { status: 400 });
  }

  const parsed = JSON.parse(config.config as string) as {
    apiKey: string;
    assistantId?: string;
    phoneNumberId?: string;
  };

  const resolvedAssistantId = assistantId || parsed.assistantId;
  const resolvedPhoneNumberId = phoneNumberId || parsed.phoneNumberId;

  if (!resolvedAssistantId) {
    return NextResponse.json({ error: "No assistantId provided and no default configured" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    assistantId: resolvedAssistantId,
    customer: { number: phoneNumber },
  };

  if (resolvedPhoneNumberId) {
    payload.phoneNumberId = resolvedPhoneNumberId;
  }

  const res = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${parsed.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "VAPI API error", details: text }, { status: res.status });
  }

  const data = await res.json() as { id: string; status: string };
  return NextResponse.json({ callId: data.id, status: data.status });
}
