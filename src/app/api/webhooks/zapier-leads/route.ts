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
    const { full_name, first_name, last_name, email, phone_number, form_id, ad_id, adset_id, campaign_id } = body;

    // Parse name — all fields optional, use fallbacks
    let firstName = "Unknown";
    let lastName = "";
    if (full_name) {
      const nameParts = full_name.trim().split(/\s+/);
      firstName = nameParts[0] || "Unknown";
      lastName = nameParts.slice(1).join(" ") || "";
    }
    if (first_name) firstName = first_name;
    if (last_name) lastName = last_name;

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
          ChannelRouterService.routeContact(lead as any, campaign, ch, config.scriptId)
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

    // Run general lead routing only if zapierConfig didn't already handle it
    // (avoids duplicate contact attempts and double sequence enrollment)
    if (!result.deduplicated && !zapierConfig) {
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
