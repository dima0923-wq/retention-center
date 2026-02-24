import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PostmarkService } from "@/services/channel/postmark.service";
import { EmailTemplateService } from "@/services/email-template.service";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

const emailSchema = z.object({
  to: z.string().email("Valid email is required"),
  subject: z.string().min(1, "Subject is required").optional(),
  body: z.string().min(1, "Body is required").optional(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().optional(),
  templateId: z.string().optional(),
}).refine(
  (data) => data.templateId || (data.subject && data.body),
  { message: "Either templateId or subject+body is required" }
);

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, "retention:templates:manage");
    const rawBody = await req.json();
    const parsed = emailSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { to, fromEmail, fromName, templateId } = parsed.data;
    let subject = parsed.data.subject ?? "";
    let htmlBody = parsed.data.body ?? "";
    let textBody: string | null = null;
    let resolvedFromEmail = fromEmail;
    let resolvedFromName = fromName;

    // If templateId is provided, load and render the template
    if (templateId) {
      const template = await EmailTemplateService.getById(templateId);
      if (!template) {
        return NextResponse.json({ error: "Email template not found" }, { status: 404 });
      }

      const testVars: Record<string, string> = {
        firstName: "Test",
        lastName: "User",
        email: to,
        phone: "+1 555-0123",
      };
      const rendered = EmailTemplateService.renderTemplate(template, testVars);
      subject = rendered.subject;
      htmlBody = rendered.htmlBody;
      textBody = rendered.textBody;
      resolvedFromEmail = resolvedFromEmail ?? template.fromEmail;
      resolvedFromName = resolvedFromName ?? template.fromName;
    }

    // Create a minimal lead object for PostmarkService
    const fakeLead = {
      id: "test",
      externalId: null,
      firstName: "Test",
      lastName: "User",
      phone: null,
      email: to,
      source: "test",
      status: "NEW",
      meta: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await PostmarkService.sendEmail(
      fakeLead as Parameters<typeof PostmarkService.sendEmail>[0],
      {
        subject,
        htmlBody,
        textBody,
        fromEmail: resolvedFromEmail,
        fromName: resolvedFromName,
      },
      {
        tag: templateId ? `test-template:${templateId}` : "test-send",
        ...(templateId ? { metadata: { templateId } } : {}),
      }
    );

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      messageId: result.providerRef,
      templateId: templateId ?? null,
      note: templateId
        ? "Test email sent via Postmark using template."
        : "Test email sent via Postmark.",
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/test-send/postmark-email error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
