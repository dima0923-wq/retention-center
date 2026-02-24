import { NextRequest, NextResponse } from "next/server";
import { PostmarkWebhookService } from "@/services/postmark-webhook.service";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Validate payload has required Postmark fields
    if (!PostmarkWebhookService.validate(data)) {
      return NextResponse.json(
        { error: "Invalid payload: missing MessageID or RecordType" },
        { status: 400 }
      );
    }

    await PostmarkWebhookService.handleEvent(data);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
