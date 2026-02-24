import { NextRequest, NextResponse } from "next/server";
import { EmailTemplateService } from "@/services/email-template.service";
import { emailTemplateUpdateSchema } from "@/lib/validators";
import { verifyApiAuth, authErrorResponse, AuthError , requirePermission } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(_req);
    requirePermission(user, 'retention:templates:manage');
    const { id } = await context.params;
    const template = await EmailTemplateService.getById(id);
    if (!template) {
      return NextResponse.json({ error: "Email template not found" }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/email-templates/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
    const { id } = await context.params;
    const body = await req.json();
    const parsed = emailTemplateUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const template = await EmailTemplateService.update(id, parsed.data);
    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("PUT /api/email-templates/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(_req);
    requirePermission(user, 'retention:templates:manage');
    const { id } = await context.params;
    await EmailTemplateService.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof Error) {
      if (error.message === "Email template not found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("active default")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    console.error("DELETE /api/email-templates/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
