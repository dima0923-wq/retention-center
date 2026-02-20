import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { verifyApiAuth, AuthError, authErrorResponse } from "@/lib/api-auth";

const emailSchema = z.object({
  to: z.string().email("Valid email is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  campaignId: z.string().min(1, "Campaign is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const INSTANTLY_BASE = "https://api.instantly.ai/api/v2";

export async function POST(req: NextRequest) {
  try {
    await verifyApiAuth(req);
    const rawBody = await req.json();
    const parsed = emailSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { to, subject, body, campaignId, firstName, lastName } = parsed.data;

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
      note: "Lead added to Instantly campaign. Email will be sent according to the campaign schedule.",
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/test-send/email error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
