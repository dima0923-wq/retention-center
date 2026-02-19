import { NextRequest, NextResponse } from "next/server";
import { getOverviewStats } from "@/services/report.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const stats = await getOverviewStats({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch overview stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch overview stats" },
      { status: 500 }
    );
  }
}
