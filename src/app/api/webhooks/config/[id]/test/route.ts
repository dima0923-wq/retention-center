import { NextRequest, NextResponse } from "next/server";
import { WebhookService } from "@/services/webhook.service";
import { verifyApiAuth, authErrorResponse, AuthError, requirePermission } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
    const { id } = await context.params;

    const result = await WebhookService.testWebhook(id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/webhooks/config/[id]/test error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
