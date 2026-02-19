import { NextResponse } from "next/server";
import { getEmailAnalytics } from "@/services/report.service";

export async function GET() {
  try {
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
    console.error("Failed to fetch email analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch email analytics" },
      { status: 500 }
    );
  }
}
