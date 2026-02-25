import { NextRequest, NextResponse } from "next/server";
import { keitaroClient, KeitaroError } from "@/lib/keitaro-client";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:analytics:view");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const params = req.nextUrl.searchParams;
  const campaignId = params.get("campaign_id");
  const from = params.get("from");
  const to = params.get("to");

  // Default date range: last 30 days
  const toDate = to ?? new Date().toISOString().slice(0, 10);
  const fromDate = (() => {
    if (from) return from;
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  try {
    if (campaignId) {
      const id = parseInt(campaignId, 10);
      if (isNaN(id)) {
        return NextResponse.json({ error: "Invalid campaign_id" }, { status: 400 });
      }
      const stats = await keitaroClient.getCampaignStats(id, { from: fromDate, to: toDate });
      return NextResponse.json(stats);
    }

    // No campaign_id — return conversion log summary
    const conversions = await keitaroClient.getConversionLog({
      from: fromDate,
      to: toDate,
      limit: 500,
    });
    return NextResponse.json({ conversions, from: fromDate, to: toDate });
  } catch (error) {
    if (error instanceof KeitaroError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      );
    }
    console.error("GET /api/keitaro/stats error:", error);
    return NextResponse.json({ error: "Failed to fetch Keitaro stats" }, { status: 502 });
  }
}
