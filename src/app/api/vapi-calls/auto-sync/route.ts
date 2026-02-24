import { NextRequest, NextResponse } from "next/server";
import { VapiSyncService } from "@/services/vapi-sync.service";

const CRON_SECRET = process.env.CRON_SECRET || "retention-cron-secret-2026";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") || req.headers.get("x-cron-secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await VapiSyncService.syncCalls();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[VAPI AutoSync] Error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
