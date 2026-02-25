import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";
import { SmsDeliveryLogService } from "@/services/sms-delivery-log.service";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, "retention:analytics:view");

    const result = await SmsDeliveryLogService.getStats();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch SMS delivery stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch SMS delivery stats" },
      { status: 500 }
    );
  }
}
