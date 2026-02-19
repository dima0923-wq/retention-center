import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const emailSchema = z.object({
  to: z.string().email("Valid email is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  campaignId: z.string().optional(),
});

const INSTANTLY_BASE = "https://api.instantly.ai/api/v2";

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const parsed = emailSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { to, subject, body, campaignId } = parsed.data;

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
      defaultCampaignId?: string;
    };

    const resolvedCampaignId = campaignId || instantlyConfig.defaultCampaignId;

    if (!resolvedCampaignId) {
      return NextResponse.json(
        { error: "No campaignId provided and no default campaign configured" },
        { status: 400 }
      );
    }

    const res = await fetch(`${INSTANTLY_BASE}/leads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${instantlyConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        campaign_id: resolvedCampaignId,
        email: to,
        custom_variables: {
          subject,
          body,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Instantly API error", details: text },
        { status: res.status }
      );
    }

    const data = (await res.json()) as { id?: string };
    return NextResponse.json({
      success: true,
      messageId: data.id ?? resolvedCampaignId,
    });
  } catch (error) {
    console.error("POST /api/test-send/email error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
