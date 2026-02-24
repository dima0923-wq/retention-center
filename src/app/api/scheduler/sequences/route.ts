import { NextRequest, NextResponse } from "next/server";
import { SequenceProcessorService } from "@/services/sequence-processor.service";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, 'retention:campaigns:edit');
    const result = await SequenceProcessorService.runAll();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Error processing sequences:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process sequences" },
      { status: 500 }
    );
  }
}
