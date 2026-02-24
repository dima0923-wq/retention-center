import { NextRequest, NextResponse } from "next/server";
import { PostmarkService } from "@/services/channel/postmark.service";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:templates:manage");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const url = new URL(req.url);
  const count = Math.min(Number(url.searchParams.get("count") ?? "50"), 100);
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const result = await PostmarkService.listSenderSignatures({ count, offset });
  if (result && "error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:templates:manage");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const body = await req.json();
  const { fromEmail, name, replyToEmail } = body;

  if (!fromEmail || !name) {
    return NextResponse.json(
      { error: "fromEmail and name are required" },
      { status: 400 }
    );
  }

  const result = await PostmarkService.createSenderSignature({
    fromEmail,
    name,
    replyToEmail,
  });
  if (result && "error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json(result, { status: 201 });
}
