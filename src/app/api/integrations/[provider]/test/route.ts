import { NextRequest, NextResponse } from "next/server";
import { VapiService } from "@/services/channel/vapi.service";
import { SmsService } from "@/services/channel/sms.service";
import { EmailService } from "@/services/channel/email.service";
import { PostmarkService } from "@/services/channel/postmark.service";
import { verifyApiAuth, AuthError, authErrorResponse } from "@/lib/api-auth";

type Params = { params: Promise<{ provider: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await verifyApiAuth(req);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
    case "instantly":
      // Both email and instantly use the EmailService (backed by Instantly)
      result = await EmailService.testConnection();
      break;
    case "postmark":
      result = await PostmarkService.testConnection();
      break;
    default:
      return NextResponse.json(
        { error: `Unknown provider: ${provider}` },
        { status: 400 }
      );
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
