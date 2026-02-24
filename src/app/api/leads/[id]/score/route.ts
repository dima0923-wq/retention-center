import { NextRequest, NextResponse } from "next/server";
import { LeadScoringService } from "@/services/lead-scoring.service";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, 'retention:contacts:view');
    const { id } = await params;
    const breakdown = await LeadScoringService.getScoreBreakdown(id);
    return NextResponse.json(breakdown);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("GET /api/leads/[id]/score error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, 'retention:contacts:manage');
    const { id } = await params;
    const breakdown = await LeadScoringService.calculateScore(id);
    return NextResponse.json(breakdown);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("POST /api/leads/[id]/score error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
