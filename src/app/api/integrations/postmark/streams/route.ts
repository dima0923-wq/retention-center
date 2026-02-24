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

  const result = await PostmarkService.listMessageStreams();
  if (result && "error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    streams: result.MessageStreams,
    totalCount: result.TotalCount,
  });
}
