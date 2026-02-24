import { NextRequest, NextResponse } from "next/server";
import { PostmarkService } from "@/services/channel/postmark.service";
import { verifyApiAuth, AuthError, authErrorResponse } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    await verifyApiAuth(req);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const url = new URL(req.url);
  const count = Math.min(Number(url.searchParams.get("count") ?? "25"), 100);
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const [bounces, deliveryStats] = await Promise.all([
    PostmarkService.getBounces({ count, offset }),
    PostmarkService.getDeliveryStatistics(),
  ]);

  if (bounces && "error" in bounces) {
    return NextResponse.json({ error: bounces.error }, { status: 502 });
  }

  return NextResponse.json({
    bounces: bounces.Bounces,
    totalCount: bounces.TotalCount,
    deliveryStats: deliveryStats && !("error" in deliveryStats) ? deliveryStats : null,
  });
}
