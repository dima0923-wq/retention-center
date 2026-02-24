import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { EmailTemplateService } from "@/services/email-template.service";
import { PostmarkService } from "@/services/channel/postmark.service";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

const sendSchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
  variables: z.record(z.string(), z.string()).optional(),
  tag: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:templates:manage");

    const { id } = await context.params;
    const body = await req.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const template = await EmailTemplateService.getById(id);
    if (!template) {
      return NextResponse.json({ error: "Email template not found" }, { status: 404 });
    }

    const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!lead.email) {
      return NextResponse.json({ error: "Lead has no email address" }, { status: 400 });
    }

    // Build variable map from lead data + any overrides
    const leadVars: Record<string, string> = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email ?? "",
      phone: lead.phone ?? "",
    };
    const variables = { ...leadVars, ...(parsed.data.variables ?? {}) };

    // Render template with variables
    const rendered = EmailTemplateService.renderTemplate(template, variables);

    const result = await PostmarkService.sendEmail(lead, {
      subject: rendered.subject,
      htmlBody: rendered.htmlBody,
      textBody: rendered.textBody,
      fromEmail: template.fromEmail,
      fromName: template.fromName,
    }, {
      tag: parsed.data.tag ?? `template:${template.id}`,
      metadata: { templateId: template.id, templateName: template.name },
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      messageId: result.providerRef,
      templateId: template.id,
      templateName: template.name,
      to: lead.email,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/email-templates/[id]/send error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
