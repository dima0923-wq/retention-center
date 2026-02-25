import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual as _timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { ABTestService } from "@/services/ab-test.service";
import { RetentionSequenceService } from "@/services/retention-sequence.service";
import { MetaCapiService } from "@/services/meta-capi.service";
import { LeadScoringService } from "@/services/lead-scoring.service";

/** Constant-time string comparison to prevent timing attacks */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return _timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function validateKeitaroSecret(req: NextRequest): NextResponse | null {
  const expectedSecret = process.env.KEITARO_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error("[SECURITY] KEITARO_WEBHOOK_SECRET not set — rejecting all requests");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const secret = req.nextUrl.searchParams.get("secret") || req.headers.get("x-webhook-secret");
  if (!secret || !timingSafeEqual(expectedSecret, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

interface KeitaroParams {
  sub_id?: string;
  status?: string;
  payout?: string;
  click_id?: string;
}

async function handlePostback(params: KeitaroParams): Promise<{ id: string } | NextResponse> {
  const { sub_id, status = "lead", payout, click_id } = params;

  // Idempotency: avoid duplicate conversions for same sub_id + source
  if (sub_id) {
    const existing = await prisma.conversion.findFirst({ where: { subId: sub_id, source: "keitaro" } });
    if (existing) return NextResponse.json({ status: "duplicate", id: existing.id });
  }

  // Look up lead by sub_id matching contactAttempt.id or lead.externalId
  let leadId: string | null = null;
  let campaignId: string | null = null;
  let channel: string | null = null;
  let contactAttemptId: string | null = null;

  if (sub_id) {
    // First try: match contactAttempt.id
    const attempt = await prisma.contactAttempt.findUnique({
      where: { id: sub_id },
      select: { id: true, leadId: true, campaignId: true, channel: true },
    });

    if (attempt) {
      leadId = attempt.leadId;
      campaignId = attempt.campaignId;
      channel = attempt.channel;
      contactAttemptId = attempt.id;
    } else {
      // Second try: match lead.externalId
      const lead = await prisma.lead.findFirst({
        where: { externalId: sub_id },
        select: { id: true },
      });
      if (lead) {
        leadId = lead.id;
      }
    }
  }

  // Create conversion record
  const conversion = await prisma.conversion.create({
    data: {
      leadId,
      campaignId,
      channel,
      revenue: payout ? parseFloat(payout) || 0 : 0,
      status,
      subId: sub_id || null,
      clickId: click_id || null,
      source: "keitaro",
      postbackData: JSON.stringify(params),
      contactAttemptId,
    },
  });

  // Fire Meta CAPI event if lead found
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (lead) {
      if (status === "sale") {
        MetaCapiService.sendConversionEvent(lead, conversion.revenue, conversion.id).catch((err) => {
          console.error("Meta CAPI conversion event failed:", err);
        });
      } else if (status === "lead" && lead.source === "META") {
        MetaCapiService.sendLeadEvent(lead).catch((err) => {
          console.error("Meta CAPI lead event failed:", err);
        });
      }
    }
  }

  // Record A/B test outcome if the contact attempt was part of a test
  if (contactAttemptId) {
    const attempt = await prisma.contactAttempt.findUnique({
      where: { id: contactAttemptId },
      select: { notes: true },
    });

    if (attempt?.notes) {
      const abMatch = attempt.notes.match(
        /ab_test:([^:]+):variant:(A|B)/
      );
      if (abMatch) {
        const [, testId, variant] = abMatch;
        const converted = status === "sale";
        await ABTestService.recordOutcome(
          testId,
          variant as "A" | "B",
          converted
        );
        await ABTestService.autoEndTest(testId);
      }
    }
  }

  // Update lead status if lead found
  if (leadId) {
    if (status === "sale") {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: "CONVERTED" },
      });

      // Recalculate score immediately (will be 100/HOT for CONVERTED status)
      LeadScoringService.calculateScore(leadId).catch((err) => {
        console.error("Score recalculation failed after conversion:", err);
      });

      // Auto-complete all active sequence enrollments for this lead
      RetentionSequenceService.markConverted(leadId).catch((err) => {
        console.error("Failed to mark sequence enrollments as converted:", err);
      });
    } else if (status === "reject") {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: "REJECTED" },
      });

      // Recalculate score for rejected leads
      LeadScoringService.calculateScore(leadId).catch((err) => {
        console.error("Score recalculation failed after rejection:", err);
      });
    }
  }

  // Fire-and-forget webhook to Hermes for conversion feedback loop
  const hermesWebhookUrl = process.env.HERMES_WEBHOOK_URL;
  const hermesWebhookSecret = process.env.HERMES_WEBHOOK_SECRET;
  if (hermesWebhookUrl) {
    fetch(`${hermesWebhookUrl}/api/webhooks/conversions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": hermesWebhookSecret || "",
      },
      body: JSON.stringify({
        lead_id: leadId,
        campaign_id: campaignId,
        revenue: payout ? parseFloat(payout) || 0 : 0,
        conversion_type: status,
        sub_id: sub_id,
        source: "keitaro",
        timestamp: new Date().toISOString(),
      }),
    }).catch((err) => {
      console.error("[Hermes webhook] Failed to notify:", err.message);
    });
  }

  return conversion;
}

export async function GET(req: NextRequest) {
  const authError = validateKeitaroSecret(req);
  if (authError) return authError;

  try {
    const url = req.nextUrl;
    const params: KeitaroParams = {
      sub_id: url.searchParams.get("sub_id") || undefined,
      status: url.searchParams.get("status") || undefined,
      payout: url.searchParams.get("payout") || undefined,
      click_id: url.searchParams.get("click_id") || undefined,
    };

    const result = await handlePostback(params);
    if (result instanceof NextResponse) return result;
    return NextResponse.json({ received: true, conversion_id: result.id });
  } catch (error) {
    console.error("Keitaro GET postback error:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const authError = validateKeitaroSecret(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const params: KeitaroParams = {
      sub_id: body.sub_id,
      status: body.status,
      payout: body.payout?.toString(),
      click_id: body.click_id,
    };

    const result = await handlePostback(params);
    if (result instanceof NextResponse) return result;
    return NextResponse.json({ received: true, conversion_id: result.id });
  } catch (error) {
    console.error("Keitaro POST postback error:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
