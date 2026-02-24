import { NextRequest, NextResponse } from "next/server";
import { EmailTemplateService } from "@/services/email-template.service";
import { emailTemplateCreateSchema, emailTemplateFiltersSchema } from "@/lib/validators";
import { verifyApiAuth, authErrorResponse, AuthError } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = emailTemplateFiltersSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const templates = await EmailTemplateService.list(parsed.data);
    return NextResponse.json(templates);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/email-templates error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    const body = await req.json();
    const parsed = emailTemplateCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const template = await EmailTemplateService.create(parsed.data);
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/email-templates error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
