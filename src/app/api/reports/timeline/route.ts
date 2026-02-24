import { NextRequest, NextResponse } from "next/server";
import { getTimeline } from "@/services/report.service";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, 'retention:analytics:view');
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (from && isNaN(new Date(from).getTime())) return NextResponse.json({ error: "Invalid 'from' date" }, { status: 400 });
    if (to && isNaN(new Date(to).getTime())) return NextResponse.json({ error: "Invalid 'to' date" }, { status: 400 });

    const timeline = await getTimeline({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    return NextResponse.json(timeline);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch timeline:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline" },
      { status: 500 }
    );
  }
}
