import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SmsService } from "@/services/channel/sms.service";

/** Normalize raw provider status to canonical status */
function normalizeStatus(rawStatus: string): string {
  const map: Record<string, string> = {
    delivered: "DELIVERED",
    DELIVRD: "DELIVERED",
    sent: "SENT",
    failed: "FAILED",
    UNDELIV: "FAILED",
    undelivered: "FAILED",
    pending: "PENDING",
    queued: "PENDING",
    SENT: "SENT",
    PENDING: "PENDING",
  };
  return map[rawStatus] ?? "UNKNOWN";
}

/** Extract sender IP from request headers */
function extractIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return null;
}

/** Detect provider and extract providerRef + rawStatus from payload */
function parsePayload(data: Record<string, unknown>): {
  provider: string;
  providerRef: string;
  rawStatus: string;
} | null {
  if (data.messageId != null) {
    // 23telecom: { messageId: "abc-123", status: "DELIVRD" }
    return {
      provider: "23telecom",
      providerRef: String(data.messageId),
      rawStatus: String(data.status ?? ""),
    };
  }
  if (data.id != null) {
    // sms-retail: { id: 12345, status: "delivered" }
    return {
      provider: "sms-retail",
      providerRef: String(data.id),
      rawStatus: String(data.status ?? ""),
    };
  }
  return null;
}

/** Optional webhook secret verification */
async function verifyWebhookSecret(
  req: NextRequest,
  rawBody: string,
  provider: string
): Promise<boolean> {
  try {
    const config = await prisma.integrationConfig.findFirst({
      where: { type: "SMS", isActive: true },
    });
    if (!config) return true;

    const parsed =
      typeof config.config === "string"
        ? JSON.parse(config.config)
        : config.config;
    const secret = parsed?.webhookSecret;
    if (!secret) return true; // No secret configured = skip verification

    if (provider === "sms-retail") {
      const signature = req.headers.get("x-signature");
      if (!signature) return false;
      // HMAC-SHA256 verification
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const expected = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return signature === expected;
    }

    if (provider === "23telecom") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      return token === secret;
    }

    return true;
  } catch {
    return true; // On error, don't block
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: true });
    }

    // Handle ping/verification requests
    if (!data || (!data.id && !data.messageId && !data.status)) {
      return NextResponse.json({ success: true });
    }

    const senderIp = extractIp(req);
    const parsed = parsePayload(data);

    if (!parsed) {
      console.warn("[sms-webhook] Unknown payload shape:", JSON.stringify(data).slice(0, 200));
      return NextResponse.json({ success: true });
    }

    const { provider, providerRef, rawStatus } = parsed;

    // Optional: verify webhook secret
    const verified = await verifyWebhookSecret(req, rawBody, provider);
    if (!verified) {
      console.warn(`[sms-webhook] Webhook secret verification failed for ${provider}`);
      return NextResponse.json({ success: true });
    }

    const status = normalizeStatus(rawStatus);

    // Find matching ContactAttempt by providerRef
    const attempt = await prisma.contactAttempt.findFirst({
      where: { providerRef },
    });

    // Create SmsDeliveryEvent record
    await prisma.smsDeliveryEvent.create({
      data: {
        contactAttemptId: attempt?.id ?? null,
        providerRef,
        provider,
        status,
        rawStatus,
        rawPayload: JSON.stringify(data),
        senderIp,
      },
    });

    // Update ContactAttempt status via existing SmsService.handleCallback
    if (attempt) {
      await SmsService.handleCallback({
        messageId: data.messageId != null ? String(data.messageId) : undefined,
        id: data.id != null ? Number(data.id) : undefined,
        status: String(data.status),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[sms-webhook] Error processing callback:", error);
    // Always return 200 — providers will retry on errors
    return NextResponse.json({ success: true });
  }
}
