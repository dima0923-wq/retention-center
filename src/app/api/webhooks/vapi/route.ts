import { NextRequest, NextResponse } from "next/server";
import { VapiService } from "@/services/channel/vapi.service";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    await VapiService.handleCallback(data);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
