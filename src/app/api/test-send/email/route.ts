import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";
import { EmailTemplateService } from "@/services/email-template.service";

const emailSchema = z.object({
  to: z.string().email("Valid email is required"),
  subject: z.string().min(1, "Subject is required").optional(),
  body: z.string().min(1, "Body is required").optional(),
  campaignId: z.string().min(1, "Campaign is required"),
  templateId: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
}).refine(
  (data) => data.templateId || (data.subject && data.body),
  { message: "Either templateId or subject+body is required" }
);

const INSTANTLY_BASE = "https://api.instantly.ai/api/v2";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
    const rawBody = await req.json();
    const parsed = emailSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { to, campaignId, templateId, firstName, lastName } = parsed.data;
    let subject = parsed.data.subject ?? "";
    let body = parsed.data.body ?? "";

    // If templateId is provided, load and render the template
    if (templateId) {
      const template = await EmailTemplateService.getById(templateId);
      if (!template) {
        return NextResponse.json({ error: "Email template not found" }, { status: 404 });
      }

      const testVars: Record<string, string> = {
        firstName: firstName || "Test",
        lastName: lastName || "User",
        email: to,
        phone: "+1 555-0123",
      };
      const rendered = EmailTemplateService.renderTemplate(template, testVars);
      // Template values are used as defaults; explicit subject/body override
      if (!subject) subject = rendered.subject;
      if (!body) body = rendered.htmlBody;
    }

    // Verify the Instantly campaign exists before adding the lead
    const instantlyConfigForCheck = await prisma.integrationConfig.findUnique({
      where: { provider: "instantly" },
    });
    if (instantlyConfigForCheck?.isActive) {
      const checkApiKey = (JSON.parse(instantlyConfigForCheck.config as string) as { apiKey: string }).apiKey;
      const campaignCheckRes = await fetch(
        `https://api.instantly.ai/api/v2/campaigns/${campaignId}`,
        { headers: { Authorization: `Bearer ${checkApiKey}` } }
      );
      if (!campaignCheckRes.ok) {
        return NextResponse.json(
          { error: "Campaign not found in Instantly", campaignId },
          { status: 400 }
        );
      }
    }

    const config = await prisma.integrationConfig.findUnique({
      where: { provider: "instantly" },
    });

    if (!config || !config.isActive) {
      return NextResponse.json(
        { error: "Instantly integration not configured or inactive" },
        { status: 400 }
      );
    }

    const instantlyConfig = JSON.parse(config.config as string) as {
      apiKey: string;
    };

    // Add lead to the Instantly campaign — Instantly sends via campaign schedule
    const res = await fetch(`${INSTANTLY_BASE}/leads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${instantlyConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        campaign: campaignId,
        email: to,
        first_name: firstName || "Test",
        last_name: lastName || "User",
        skip_if_in_campaign: false,
        custom_variables: {
          subject,
          body,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Instantly API error:", text);
      return NextResponse.json(
        { error: "Instantly API error", details: text },
        { status: res.status }
      );
    }

    const data = (await res.json()) as { id?: string };
    return NextResponse.json({
      success: true,
      leadId: data.id,
      templateId: templateId ?? null,
      note: templateId
        ? "Lead added to Instantly campaign using template. Email will be sent according to the campaign schedule."
        : "Lead added to Instantly campaign. Email will be sent according to the campaign schedule.",
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/test-send/email error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
