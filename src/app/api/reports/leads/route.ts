import { NextRequest, NextResponse } from "next/server";
import { getLeadFunnel } from "@/services/report.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const funnel = await getLeadFunnel({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    return NextResponse.json(funnel);
  } catch (error) {
    console.error("Failed to fetch lead funnel:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead funnel" },
      { status: 500 }
    );
  }
}
