import { NextRequest, NextResponse } from "next/server";
import { VapiService } from "@/services/channel/vapi.service";
import { SmsService } from "@/services/channel/sms.service";
import { EmailService } from "@/services/channel/email.service";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ provider: string }> };

async function testInstantly(): Promise<{ ok: boolean; error?: string }> {
  const config = await prisma.integrationConfig.findUnique({
    where: { provider: "instantly" },
  });
  if (!config) return { ok: false, error: "Instantly not configured" };

  const parsed = JSON.parse(config.config as string);
  const apiKey = parsed.apiKey;
  if (!apiKey) return { ok: false, error: "API key missing" };

  try {
    const res = await fetch(
      "https://api.instantly.ai/api/v2/campaigns?limit=1",
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `API returned ${res.status}: ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { provider } = await params;

  let result: { ok: boolean; error?: string };

  switch (provider) {
    case "vapi":
      result = await VapiService.testConnection();
      break;
    case "sms":
    case "sms-retail":
    case "23telecom":
      result = await SmsService.testConnection();
      break;
    case "email":
      result = await EmailService.testConnection();
      break;
    case "instantly":
      result = await testInstantly();
      break;
    default:
      return NextResponse.json(
        { error: `Unknown provider: ${provider}` },
        { status: 400 }
      );
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
