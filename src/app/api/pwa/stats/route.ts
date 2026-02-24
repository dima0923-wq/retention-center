import { NextRequest, NextResponse } from "next/server";
import { pwaflowService, PwaFlowServiceError } from "@/services/pwaflow.service";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:pwa:view");

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

    // Also fetch PWA list for summary stats
    const [activePwas, archivedPwas] = await Promise.all([
      pwaflowService.listPwas({ page: 1, limit: 1, archived: false }),
      pwaflowService.listPwas({ page: 1, limit: 1, archived: true }),
    ]);

    const totalPwas = (activePwas.meta.total ?? 0) + (archivedPwas.meta.total ?? 0);

    // Extract install and push subscriber counts from statistics events
    const installs = data.events?.install ?? data.events?.installed ?? 0;
    const pushSubscribers = data.events?.push_subscribe ?? data.events?.push_subscribed ?? 0;

    return NextResponse.json({
      totalPwas,
      activePwas: activePwas.meta.total ?? 0,
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
