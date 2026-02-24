import { NextRequest, NextResponse } from "next/server";
import { EmailTemplateService } from "@/services/email-template.service";
import { verifyApiAuth, authErrorResponse, AuthError } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(_req);
    const { id } = await context.params;
    const template = await EmailTemplateService.duplicate(id);
    if (!template) {
      return NextResponse.json({ error: "Email template not found" }, { status: 404 });
    }
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/email-templates/[id]/duplicate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
