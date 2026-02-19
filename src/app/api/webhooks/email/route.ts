import { NextRequest, NextResponse } from "next/server";
import { InstantlyService } from "@/services/channel/email.service";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-webhook-token") || req.nextUrl.searchParams.get("token");
  const expectedToken = process.env.INSTANTLY_WEBHOOK_SECRET;
  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    await InstantlyService.handleWebhookEvent(data);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
