import { NextRequest, NextResponse } from "next/server";
import { pwaflowService, PwaFlowServiceError } from "@/services/pwaflow.service";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:pwa:view");

    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const archived = req.nextUrl.searchParams.get("archived") === "true";

    const data = await pwaflowService.listPushes({ page, limit, archived });
    return NextResponse.json({ result: "success", data });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof PwaFlowServiceError) {
      return NextResponse.json(
        { error: error.message, apiError: error.apiError },
        { status: error.statusCode || 502 },
      );
    }
    console.error("GET /api/pwa/pushes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
