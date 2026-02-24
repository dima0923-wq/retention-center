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

  const overview = await PostmarkService.getOutboundStats();
  if (overview && "error" in overview) {
    return NextResponse.json({ error: overview.error }, { status: 502 });
  }

  return NextResponse.json({ overview });
}
