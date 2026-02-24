import { NextRequest, NextResponse } from "next/server";
import { LeadService } from "@/services/lead.service";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, 'retention:analytics:view');
    const stats = await LeadService.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/leads/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
