import { NextRequest, NextResponse } from "next/server";
import { EmailService } from "@/services/channel/email.service";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    await EmailService.handleCallback(data);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
