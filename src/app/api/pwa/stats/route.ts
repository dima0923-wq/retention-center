import { NextRequest, NextResponse } from "next/server";
import { pwaflowService, PwaFlowServiceError } from "@/services/pwaflow.service";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:analytics:view");

    const startDate = req.nextUrl.searchParams.get("startDate") || undefined;
    const endDate = req.nextUrl.searchParams.get("endDate") || undefined;
    const pwaIdsParam = req.nextUrl.searchParams.get("pwaIds");
    const pwaIds = pwaIdsParam
      ? pwaIdsParam.split(",").map(Number).filter((n) => !isNaN(n))
      : undefined;
    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const limit = Number(req.nextUrl.searchParams.get("limit") || "50");

    const data = await pwaflowService.getStatistics({
      start_date: startDate,
      end_date: endDate,
      pwa_ids: pwaIds,
      page,
      limit,
    });

    // Fetch PWA lists to count total items (meta.total = total pages, not items)
    const [activePwas, archivedPwas] = await Promise.all([
      pwaflowService.listPwas({ page: 1, limit: 100, archived: false }),
      pwaflowService.listPwas({ page: 1, limit: 100, archived: true }),
    ]);

    const activeCount = activePwas.pwas.length;
    const archivedCount = archivedPwas.pwas.length;
    const totalPwas = activeCount + archivedCount;

    // Real event keys from PwaFlow statistics API
    const events = data.events ?? {};
    const installs = events.installs ?? 0;
    const pushSubscribers = events.push_accepted ?? 0;

    return NextResponse.json({
      totalPwas,
      activePwas: activeCount,
      totalInstalls: installs,
      pushSubscribers,
      statistics: data,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof PwaFlowServiceError) {
      return NextResponse.json(
        { error: error.message, apiError: error.apiError },
        { status: error.statusCode || 502 },
      );
    }
    console.error("GET /api/pwa/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
