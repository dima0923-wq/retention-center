import { NextRequest, NextResponse } from "next/server";
import { getCampaignComparison } from "@/services/report.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const campaigns = await getCampaignComparison({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    return NextResponse.json(campaigns);
  } catch (error) {
    console.error("Failed to fetch campaign comparison:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign comparison" },
      { status: 500 }
    );
  }
}
