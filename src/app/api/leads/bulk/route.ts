import { NextRequest, NextResponse } from "next/server";
import { LeadService } from "@/services/lead.service";
import { CampaignService } from "@/services/campaign.service";
import { LeadRouterService } from "@/services/lead-router.service";
import { leadBulkCreateSchema } from "@/lib/validators";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, 'retention:contacts:manage');
    const body = await request.json();
    const { campaignId, ...bulkBody } = body;
    const parsed = leadBulkCreateSchema.safeParse(bulkBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Create leads individually (handles deduplication)
    const createdLeadIds: string[] = [];
    const results = { created: 0, deduplicated: 0, errors: 0 };

    for (const input of parsed.data.leads) {
      try {
        const result = await LeadService.create(input);
        if (result.deduplicated) {
          results.deduplicated++;
        } else {
          results.created++;
          createdLeadIds.push(result.lead.id);
        }
      } catch {
        results.errors++;
      }
    }

    // If campaignId provided, assign all created leads to that campaign
    if (campaignId && typeof campaignId === "string" && createdLeadIds.length > 0) {
      await CampaignService.assignLeads(campaignId, createdLeadIds);

      // Queue ALL channels for each new lead in parallel (fire-and-forget)
      for (const leadId of createdLeadIds) {
        LeadRouterService.queueAllChannels(leadId, campaignId).catch((err) => {
          console.error(`Failed to queue channels for lead ${leadId}:`, err);
        });
      }
    }

    const status = results.created > 0 ? 201 : 200;
    return NextResponse.json(
      { ...results, assigned: campaignId ? createdLeadIds.length : 0 },
      { status }
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/leads/bulk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
