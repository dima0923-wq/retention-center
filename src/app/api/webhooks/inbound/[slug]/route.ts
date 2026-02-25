import { NextRequest, NextResponse } from "next/server";
import { WebhookService } from "@/services/webhook.service";

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * GET — Facebook webhook verification handshake.
 * Facebook sends hub.mode, hub.verify_token, and hub.challenge.
 * We must respond with the challenge value if the token matches.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const query = Object.fromEntries(req.nextUrl.searchParams);

    const result = await WebhookService.processInbound(slug, "GET", {}, query);

    if ("challenge" in result) {
      // Return challenge as plain text (Facebook requirement)
      return new NextResponse(result.challenge, { status: 200 });
    }

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/webhooks/inbound/[slug] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST — Receive inbound leads from Zapier, Facebook, or Generic webhooks.
 * Always returns 200 to Facebook (they retry on non-200).
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Facebook sometimes sends empty or malformed bodies
      // Return 200 to prevent retries
      return NextResponse.json({ received: true });
    }

    const query = Object.fromEntries(req.nextUrl.searchParams);
    const result = await WebhookService.processInbound(slug, "POST", body, query);

    if ("error" in result) {
      // For Facebook webhooks, always return 200 to prevent retries
      // We check the slug to determine this since processInbound already resolved the webhook
      const webhook = await WebhookService.getBySlug(slug);
      if (webhook?.type === "facebook") {
        return NextResponse.json({ received: true });
      }
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }

    // Check if this is a Facebook webhook to format the response accordingly
    const webhook = await WebhookService.getBySlug(slug);
    if (webhook?.type === "facebook") {
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("POST /api/webhooks/inbound/[slug] error:", error);
    // Always return 200 on errors to prevent Facebook retries
    return NextResponse.json({ received: true, error: "Processing error" });
  }
}
