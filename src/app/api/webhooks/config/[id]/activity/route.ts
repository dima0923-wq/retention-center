import { NextRequest, NextResponse } from "next/server";
import { WebhookService } from "@/services/webhook.service";
import { verifyApiAuth, authErrorResponse, AuthError, requirePermission } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
    const { id } = await context.params;

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);
    const clampedLimit = Math.min(Math.max(limit, 1), 100);

    const activity = await WebhookService.getActivity(id, clampedLimit);
    if (activity === null) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }
    return NextResponse.json(activity);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/webhooks/config/[id]/activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
