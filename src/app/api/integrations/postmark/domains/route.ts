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

  const result = await PostmarkService.listDomains({ count, offset });
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
  const { domainId, action } = body;

  if (!domainId || !action) {
    return NextResponse.json(
      { error: "domainId and action (verifyDKIM|verifyReturnPath) are required" },
      { status: 400 }
    );
  }

  let result;
  if (action === "verifyDKIM") {
    result = await PostmarkService.verifyDomainDKIM(domainId);
  } else if (action === "verifyReturnPath") {
    result = await PostmarkService.verifyDomainReturnPath(domainId);
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (result && "error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json(result);
}
