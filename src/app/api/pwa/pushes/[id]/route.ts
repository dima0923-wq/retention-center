import { NextRequest, NextResponse } from "next/server";
import { pwaflowService, PwaFlowServiceError } from "@/services/pwaflow.service";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:analytics:view");

    const { id } = await params;
    const pushId = Number(id);
    if (isNaN(pushId)) {
      return NextResponse.json({ error: "Invalid push ID" }, { status: 400 });
    }

    const push = await pwaflowService.getPush(pushId);
    return NextResponse.json({ result: "success", data: { push } });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof PwaFlowServiceError) {
      return NextResponse.json(
        { error: error.message, apiError: error.apiError },
        { status: error.statusCode || 502 },
      );
    }
    console.error("GET /api/pwa/pushes/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
