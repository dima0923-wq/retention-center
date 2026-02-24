import { NextRequest, NextResponse } from "next/server";
import { EmailTemplateService } from "@/services/email-template.service";
import { verifyApiAuth, authErrorResponse, AuthError } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(_req);
    const { id } = await context.params;
    const template = await EmailTemplateService.getById(id);
    if (!template) {
      return NextResponse.json({ error: "Email template not found" }, { status: 404 });
    }
    const sampleVars = EmailTemplateService.getSampleVariables();
    const rendered = EmailTemplateService.renderTemplate(template, sampleVars);
    return NextResponse.json({
      ...rendered,
      variables: sampleVars,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/email-templates/[id]/preview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
