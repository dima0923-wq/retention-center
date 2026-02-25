import { NextRequest, NextResponse } from "next/server";
import { CleanupService } from "@/services/cleanup.service";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const secret = req.nextUrl.searchParams.get("secret") || req.headers.get("x-cron-secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await CleanupService.runAll();
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      cleanup: stats,
    });
  } catch (e) {
    console.error("[Cleanup CRON] Error:", e);
    return NextResponse.json(
      { error: "Cleanup failed", detail: (e as Error).message },
      { status: 500 }
    );
  }
}

export { GET as POST };
