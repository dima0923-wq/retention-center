import { NextRequest, NextResponse } from "next/server";
import { VapiService } from "@/services/channel/vapi.service";
import { SmsService } from "@/services/channel/sms.service";
import { EmailService } from "@/services/channel/email.service";

type Params = { params: Promise<{ provider: string }> };

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
    default:
      return NextResponse.json(
        { error: `Unknown provider: ${provider}` },
        { status: 400 }
      );
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
