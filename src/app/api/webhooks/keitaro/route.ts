import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual as _timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { ABTestService } from "@/services/ab-test.service";
import { RetentionSequenceService } from "@/services/retention-sequence.service";
import { LeadScoringService } from "@/services/lead-scoring.service";
import { OutboundPostbackService } from "@/services/outbound-postback.service";

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
  campaign_id?: string;
  campaign_name?: string;
}

async function handlePostback(params: KeitaroParams): Promise<{ id: string } | NextResponse> {
  const { sub_id, status = "lead", payout, click_id, campaign_id, campaign_name } = params;

  // Idempotency: avoid duplicate conversions for same sub_id + source + status
  // Note: lead and sale are different events for the same sub_id — do NOT deduplicate across statuses
  if (sub_id) {
    const existing = await prisma.conversion.findFirst({ where: { subId: sub_id, source: "keitaro", status } });
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

  // If no campaignId resolved yet, try to resolve via KeitaroCampaignMapping
  if (!campaignId && campaign_id) {
    const mapping = await prisma.keitaroCampaignMapping.findUnique({
      where: { keitaroCampaignId: campaign_id },
      select: { campaignId: true },
    });
    if (mapping?.campaignId) {
      campaignId = mapping.campaignId;
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
      keitaroCampaignId: campaign_id || null,
      keitaroCampaignName: campaign_name || null,
    },
  });

  // CAPI events are now fired by Traffic Center (ag3) as the single source of truth.
  // RC sends conversions to TC via OutboundPostbackService, and TC fires CAPI.

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

      // Fire outbound postbacks to Traffic Center and Keitaro
      const convertedLead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (convertedLead) {
        OutboundPostbackService.sendConversionPostback(convertedLead, conversion).catch((err) => {
          console.error("[OutboundPostback] Failed to send conversion postback:", err);
        });
      }
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
      campaign_id: url.searchParams.get("campaign_id") || undefined,
      campaign_name: url.searchParams.get("campaign_name") || undefined,
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
      campaign_id: body.campaign_id?.toString(),
      campaign_name: body.campaign_name,
    };

    const result = await handlePostback(params);
    if (result instanceof NextResponse) return result;
    return NextResponse.json({ received: true, conversion_id: result.id });
  } catch (error) {
    console.error("Keitaro POST postback error:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
