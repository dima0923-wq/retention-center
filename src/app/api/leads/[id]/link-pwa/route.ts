import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth, authErrorResponse, AuthError, requirePermission } from "@/lib/api-auth";
import { setLeadUgid, removeLeadUgid } from "@/lib/pwa-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, "retention:contacts:manage");
    const { id } = await params;
    const body = await request.json();

    if (!body.ugid || typeof body.ugid !== "string") {
      return NextResponse.json(
        { error: "ugid is required and must be a string" },
        { status: 400 }
      );
    }

    const lead = await setLeadUgid(id, body.ugid, body.pwaId);
    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof Error && error.message === "Lead not found") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    console.error("POST /api/leads/[id]/link-pwa error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, "retention:contacts:manage");
    const { id } = await params;

    const lead = await removeLeadUgid(id);
    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof Error && error.message === "Lead not found") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    console.error("DELETE /api/leads/[id]/link-pwa error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
