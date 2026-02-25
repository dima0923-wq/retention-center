import { NextRequest, NextResponse } from "next/server";
import { WebhookService } from "@/services/webhook.service";
import { webhookUpdateSchema } from "@/lib/validators";
import { verifyApiAuth, authErrorResponse, AuthError, requirePermission } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
    const { id } = await context.params;

    const webhook = await WebhookService.getById(id);
    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }
    return NextResponse.json(webhook);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/webhooks/config/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
    const { id } = await context.params;

    const body = await req.json();
    const parsed = webhookUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const webhook = await WebhookService.update(id, parsed.data);
    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }
    return NextResponse.json(webhook);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Webhook not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === "Campaign not found" || message === "Sequence not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("PATCH /api/webhooks/config/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
    const { id } = await context.params;

    const result = await WebhookService.delete(id);
    if (!result) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Webhook not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("DELETE /api/webhooks/config/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
