import { NextRequest, NextResponse } from "next/server";
import { CampaignService } from "@/services/campaign.service";
import { campaignCreateSchema, campaignFiltersSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = campaignFiltersSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = await CampaignService.list(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/campaigns error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = campaignCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const campaign = await CampaignService.create(parsed.data);
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error("POST /api/campaigns error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
