import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual as _timingSafeEqual } from "crypto";
import { WebhookService } from "@/services/webhook.service";

/** Constant-time string comparison */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return _timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Verify the request is from the casino using HMAC-SHA256 signature.
 * Casino signs the raw body with CASINO_WEBHOOK_SECRET and sends as X-Webhook-Signature header.
 * Also accepts X-API-Key header matching SERVICE_API_KEY as fallback auth.
 */
function verifyAuth(req: NextRequest, rawBody: string): boolean {
  // Method 1: HMAC signature verification
  const signature = req.headers.get("x-webhook-signature");
  const webhookSecret = process.env.CASINO_WEBHOOK_SECRET;
  if (signature && webhookSecret) {
    const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    if (timingSafeEqual(signature, expected)) return true;
  }

  // Method 2: API key auth (casino sends RC's service API key)
  const apiKey = req.headers.get("x-api-key");
  const serviceKey = process.env.SERVICE_API_KEY;
  if (apiKey && serviceKey && timingSafeEqual(apiKey, serviceKey)) return true;

  return false;
}

const WEBHOOK_SLUG = "stake-social";

/**
 * POST /api/webhooks/casino
 *
 * Receives lead registrations from Stake Social Casino.
 * Expected payload:
 * {
 *   user_id: string,      // casino user ID -> externalId
 *   first_name: string,    // -> firstName
 *   last_name: string,     // -> lastName
 *   email: string,         // -> email
 *   phone?: string,        // -> phone
 *   event?: string,        // "registration" | "deposit" | "ftd"
 *   amount?: number,       // deposit amount (for deposit/ftd events)
 *   currency?: string,     // deposit currency
 *   timestamp?: string     // ISO 8601
 * }
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyAuth(req, rawBody)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Ensure the stake-social webhook config exists
  const webhook = await WebhookService.getBySlug(WEBHOOK_SLUG);
  if (!webhook) {
    console.error("[Casino Webhook] No webhook config found for slug 'stake-social'. Create it first.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  if (!webhook.isActive) {
    return NextResponse.json({ error: "Webhook is inactive" }, { status: 403 });
  }

  // Process through the standard webhook pipeline (field mapping, dedup, routing)
  const query = Object.fromEntries(req.nextUrl.searchParams);
  const result = await WebhookService.processInbound(WEBHOOK_SLUG, "POST", body, query);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json({
    success: true,
    ...result,
  });
}
