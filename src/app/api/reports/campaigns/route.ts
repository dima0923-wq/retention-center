import { NextRequest, NextResponse } from "next/server";
import { getCampaignComparison } from "@/services/report.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (from && isNaN(new Date(from).getTime())) return NextResponse.json({ error: "Invalid 'from' date" }, { status: 400 });
    if (to && isNaN(new Date(to).getTime())) return NextResponse.json({ error: "Invalid 'to' date" }, { status: 400 });

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
