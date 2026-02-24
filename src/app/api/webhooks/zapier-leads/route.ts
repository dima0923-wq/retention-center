import { NextRequest, NextResponse } from "next/server";
import { LeadService } from "@/services/lead.service";
import { LeadRouterService } from "@/services/lead-router.service";
import { RetentionSequenceService } from "@/services/retention-sequence.service";
import { ChannelRouterService } from "@/services/channel/channel-router.service";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // Optional API key auth
    const webhookSecret = process.env.ZAPIER_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = req.headers.get("x-webhook-secret");
      if (providedSecret !== webhookSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json();
    const { full_name, email, phone_number, form_id, ad_id, adset_id, campaign_id } = body;

    // Validate required fields
    if (!full_name) {
      return NextResponse.json({ error: "full_name is required" }, { status: 400 });
    }
    if (!email && !phone_number) {
      return NextResponse.json({ error: "email or phone_number is required" }, { status: 400 });
    }

    // Parse full_name into firstName + lastName
    const nameParts = full_name.trim().split(/\s+/);
    const firstName = nameParts[0] || "Unknown";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Look up Zapier config by Meta campaign_id
    let zapierConfig = null;
    if (campaign_id) {
      zapierConfig = await prisma.zapierWebhookConfig.findFirst({
        where: { metaCampaignId: String(campaign_id), isActive: true },
        include: { campaign: true },
      });
    }

    // Create lead via LeadService
    const result = await LeadService.create({
      firstName,
      lastName,
      email: email || undefined,
      phone: phone_number || undefined,
      source: "ZAPIER",
      externalId: ad_id || form_id || undefined,
      meta: { full_name, email, phone_number, form_id, ad_id, adset_id, campaign_id },
    });

    let assignedCampaignId: string | null = null;

    if (!result.deduplicated && zapierConfig) {
      // Assign lead to the mapped campaign
      const existing = await prisma.campaignLead.findUnique({
        where: {
          campaignId_leadId: {
            campaignId: zapierConfig.campaignId,
            leadId: result.lead.id,
          },
        },
      });
      if (!existing) {
        await prisma.campaignLead.create({
          data: {
            campaignId: zapierConfig.campaignId,
            leadId: result.lead.id,
          },
        });
      }
      assignedCampaignId = zapierConfig.campaignId;

      // Route through configured channels
      const channelConfig = JSON.parse(zapierConfig.channelConfig || "{}");
      const lead = result.lead;
      const campaign = zapierConfig.campaign;

      const channelPromises: Promise<void>[] = [];
      for (const [channel, config] of Object.entries(channelConfig) as [string, { enabled?: boolean; scriptId?: string }][]) {
        if (!config?.enabled) continue;
        const ch = channel.toUpperCase();
        if (ch === "EMAIL" && !lead.email) continue;
        if ((ch === "SMS" || ch === "CALL") && !lead.phone) continue;

        channelPromises.push(
          ChannelRouterService.routeContact(lead as any, campaign, ch)
            .then((res) => {
              if ("error" in res) {
                console.error(`Zapier webhook: Failed ${ch} for lead ${lead.id}:`, res.error);
              }
            })
            .catch((err) => {
              console.error(`Zapier webhook: Failed ${ch} for lead ${lead.id}:`, err);
            })
        );
      }
      if (channelPromises.length > 0) {
        await Promise.allSettled(channelPromises);
      }

      // Auto-enroll in sequence if configured
      if (zapierConfig.autoEnrollSequenceId) {
        RetentionSequenceService.enrollLead(
          zapierConfig.autoEnrollSequenceId,
          result.lead.id
        ).catch((err) => {
          console.error("Zapier auto-enrollment failed:", err);
        });
      }
    }

    // Also run general lead routing for additional campaign matching
    if (!result.deduplicated) {
      LeadRouterService.routeNewLead(result.lead.id).catch((err) => {
        console.error("Lead auto-routing failed:", err);
      });
      RetentionSequenceService.autoEnrollByTrigger(
        result.lead.id,
        "new_lead",
        "ZAPIER"
      ).catch((err) => {
        console.error("Sequence auto-enrollment failed:", err);
      });
    }

    return NextResponse.json({
      success: true,
      leadId: result.lead.id,
      campaignId: assignedCampaignId,
      deduplicated: result.deduplicated,
    });
  } catch (error) {
    console.error("Zapier webhook error:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
