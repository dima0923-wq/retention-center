import { NextRequest, NextResponse } from "next/server";
import { getChannelPerformance } from "@/services/report.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const channels = await getChannelPerformance({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    return NextResponse.json(channels);
  } catch (error) {
    console.error("Failed to fetch channel performance:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel performance" },
      { status: 500 }
    );
  }
}
