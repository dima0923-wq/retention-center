import { NextRequest, NextResponse } from "next/server";
import { SmsService } from "@/services/channel/sms.service";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Handle ping/verification requests
    if (!data || (!data.id && !data.messageId && !data.status)) {
      return NextResponse.json({ success: true });
    }

    // Delegate to SmsService.handleCallback which handles all providers
    // and maps statuses correctly (delivered, DELIVRD, sent, failed, UNDELIV, etc.)
    await SmsService.handleCallback(data);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
