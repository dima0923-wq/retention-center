import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";
import { SmsDeliveryLogService } from "@/services/sms-delivery-log.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, "retention:analytics:view");

    const { attemptId } = await params;
    const result = await SmsDeliveryLogService.getEventsForAttempt(attemptId);

    if (!result) {
      return NextResponse.json(
        { error: "Contact attempt not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch delivery events for attempt:", error);
    return NextResponse.json(
      { error: "Failed to fetch delivery events" },
      { status: 500 }
    );
  }
}
