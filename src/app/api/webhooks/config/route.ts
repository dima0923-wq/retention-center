import { NextRequest, NextResponse } from "next/server";
import { WebhookService } from "@/services/webhook.service";
import { webhookCreateSchema } from "@/lib/validators";
import { verifyApiAuth, authErrorResponse, AuthError, requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');

    const webhooks = await WebhookService.list();
    return NextResponse.json(webhooks);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/webhooks/config error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');

    const body = await req.json();
    const parsed = webhookCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const webhook = await WebhookService.create(parsed.data);
    return NextResponse.json(webhook, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Campaign not found" || message === "Sequence not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("POST /api/webhooks/config error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
