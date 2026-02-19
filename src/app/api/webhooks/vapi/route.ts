import { NextRequest, NextResponse } from "next/server";
import { VapiService } from "@/services/channel/vapi.service";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // VAPI webhooks send { message: { type, call, ... } }
    // Normalize to the shape handleCallback expects: { type, call }
    const payload = data.message ?? data;

    await VapiService.handleCallback(payload);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
