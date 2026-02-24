import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";
import { MetaCapiService } from "@/services/meta-capi.service";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const result = await MetaCapiService.testConnection();
  if (result.ok) {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: false, error: result.error }, { status: 400 });
}
