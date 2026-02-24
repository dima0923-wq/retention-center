import { NextRequest, NextResponse } from "next/server";
import { ZapierConfigService } from "@/services/zapier-config.service";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(_req);
    requirePermission(user, 'retention:templates:manage');
    const { id } = await context.params;
    const config = await ZapierConfigService.findById(id);
    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/zapier-configs/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
    const { id } = await context.params;
    const body = await req.json();
    const config = await ZapierConfigService.update(id, body);
    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Sequence not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("PUT /api/zapier-configs/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(_req);
    requirePermission(user, 'retention:templates:manage');
    const { id } = await context.params;
    const result = await ZapierConfigService.delete(id);
    if (!result) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("DELETE /api/zapier-configs/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
