import { NextRequest, NextResponse } from "next/server";
import { getLeadFunnel } from "@/services/report.service";
import { verifyApiAuth, authErrorResponse, AuthError } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (from && isNaN(new Date(from).getTime())) return NextResponse.json({ error: "Invalid 'from' date" }, { status: 400 });
    if (to && isNaN(new Date(to).getTime())) return NextResponse.json({ error: "Invalid 'to' date" }, { status: 400 });

    const funnel = await getLeadFunnel({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    return NextResponse.json(funnel);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch lead funnel:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead funnel" },
      { status: 500 }
    );
  }
}
