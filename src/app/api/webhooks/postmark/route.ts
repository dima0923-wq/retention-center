import { NextRequest, NextResponse } from "next/server";
import { PostmarkService } from "@/services/channel/postmark.service";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    await PostmarkService.handleWebhookEvent(data as Record<string, unknown>);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
