import { NextRequest, NextResponse } from "next/server";
import { LeadService } from "@/services/lead.service";
import { CampaignService } from "@/services/campaign.service";
import { LeadRouterService } from "@/services/lead-router.service";
import { leadCreateSchema, leadFiltersSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = leadFiltersSchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid filters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, pageSize, sortBy, sortOrder, ...filters } = parsed.data;
    const result = await LeadService.list(
      filters,
      { page, pageSize },
      sortBy,
      sortOrder
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { campaignId, ...leadBody } = body;
    const parsed = leadCreateSchema.safeParse(leadBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await LeadService.create(parsed.data);

    // If campaignId provided, assign lead to that campaign and queue contact
    if (campaignId && typeof campaignId === "string") {
      await CampaignService.assignLeads(campaignId, [result.lead.id]);
      if (!result.deduplicated) {
        LeadRouterService.queueAllChannels(result.lead.id, campaignId).catch((err) => {
          console.error("Failed to queue channels:", err);
        });
      }
    } else if (!result.deduplicated) {
      // Auto-route to matching campaigns
      LeadRouterService.routeNewLead(result.lead.id).catch((err) => {
        console.error("Lead auto-routing failed:", err);
      });
    }

    return NextResponse.json(
      {
        lead: result.lead,
        deduplicated: result.deduplicated,
      },
      { status: result.deduplicated ? 200 : 201 }
    );
  } catch (error) {
    console.error("POST /api/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
