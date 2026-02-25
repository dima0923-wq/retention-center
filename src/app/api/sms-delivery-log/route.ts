import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";
import { SmsDeliveryLogService } from "@/services/sms-delivery-log.service";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, "retention:analytics:view");

    const { searchParams } = request.nextUrl;

    const filters = {
      leadId: searchParams.get("leadId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      provider: searchParams.get("provider") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      providerRef: searchParams.get("providerRef") ?? undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
    };

    const result = await SmsDeliveryLogService.listEvents(filters);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch SMS delivery log:", error);
    return NextResponse.json(
      { error: "Failed to fetch SMS delivery log" },
      { status: 500 }
    );
  }
}
