import { NextRequest, NextResponse } from "next/server";
import { LeadScoringService } from "@/services/lead-scoring.service";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, 'retention:contacts:manage');
    const body = await request.json().catch(() => ({}));
    const limit = typeof body.limit === "number" ? body.limit : 100;
    const result = await LeadScoringService.batchScoreLeads(limit);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/leads/scoring error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, 'retention:contacts:view');
    const stats = await LeadScoringService.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/leads/scoring error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
