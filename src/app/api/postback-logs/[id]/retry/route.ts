import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:analytics:view');

    const { id } = await params;
    const log = await prisma.postbackLog.findUnique({ where: { id } });
    if (!log) {
      return NextResponse.json({ error: "Postback log not found" }, { status: 404 });
    }
    if (log.status === "success") {
      return NextResponse.json({ error: "Postback already succeeded" }, { status: 400 });
    }

    // Fire the postback URL again
    let success = false;
    let httpStatus: number | undefined;
    let responseBody: string | undefined;
    let errorMessage: string | undefined;

    try {
      const res = await fetch(log.url, { method: "GET", signal: AbortSignal.timeout(10000) });
      success = res.ok;
      httpStatus = res.status;
      responseBody = await res.text().catch(() => undefined);
      if (!res.ok) errorMessage = `HTTP ${res.status}`;
    } catch (e) {
      errorMessage = (e as Error).message;
    }

    // Update the log entry
    const updated = await prisma.postbackLog.update({
      where: { id },
      data: {
        status: success ? "success" : "failed",
        httpStatus: httpStatus ?? null,
        responseBody: responseBody ?? null,
        errorMessage: errorMessage ?? null,
        retryCount: log.retryCount + 1,
      },
    });

    return NextResponse.json({ success, log: updated });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Postback log retry error:", error);
    return NextResponse.json({ error: "Failed to retry postback" }, { status: 500 });
  }
}
