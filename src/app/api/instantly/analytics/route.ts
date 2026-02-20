import { NextRequest, NextResponse } from "next/server";
import { getEmailAnalytics } from "@/services/report.service";
import { verifyApiAuth, AuthError, authErrorResponse } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    await verifyApiAuth(request);
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const to = new Date();

    const data = await getEmailAnalytics({ from, to }) as {
      totalSent: number;
      openRate: number;
      clickRate: number;
      replyRate: number;
      bounceRate: number;
      timeline: unknown[];
      topCampaigns: unknown[];
      accountHealth: unknown[];
    };

    return NextResponse.json({
      totalSent: data.totalSent,
      openRate: data.openRate,
      clickRate: data.clickRate,
      replyRate: data.replyRate,
      bounceRate: data.bounceRate,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch email analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch email analytics" },
      { status: 500 }
    );
  }
}
