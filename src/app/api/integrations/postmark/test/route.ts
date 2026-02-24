import { NextRequest, NextResponse } from "next/server";
import { PostmarkService } from "@/services/channel/postmark.service";
import { verifyApiAuth, AuthError, authErrorResponse } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    await verifyApiAuth(req);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const result = await PostmarkService.testConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

// Also support GET for the UI card's fetchDetails call
export async function GET(req: NextRequest) {
  try {
    await verifyApiAuth(req);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const result = await PostmarkService.testConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
