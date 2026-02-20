import { NextRequest, NextResponse } from "next/server";
import { SchedulerService } from "@/services/scheduler.service";
import { verifyApiAuth, authErrorResponse, AuthError } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    const result = await SchedulerService.processScheduledContacts();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Error processing scheduled contacts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process scheduled contacts" },
      { status: 500 }
    );
  }
}
