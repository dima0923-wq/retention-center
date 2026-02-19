import { NextRequest, NextResponse } from "next/server";
import { InstantlyService } from "@/services/channel/email.service";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    await InstantlyService.handleWebhookEvent(data);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
