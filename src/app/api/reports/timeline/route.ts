import { NextRequest, NextResponse } from "next/server";
import { getTimeline } from "@/services/report.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const timeline = await getTimeline({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    return NextResponse.json(timeline);
  } catch (error) {
    console.error("Failed to fetch timeline:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline" },
      { status: 500 }
    );
  }
}
