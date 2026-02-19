import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const EVENT_STATUS_MAP: Record<string, string> = {
  email_sent: "IN_PROGRESS",
  email_opened: "SUCCESS",
  reply_received: "SUCCESS",
  auto_reply_received: "SUCCESS",
  link_clicked: "SUCCESS",
  email_bounced: "FAILED",
  lead_unsubscribed: "FAILED",
  account_error: "FAILED",
  campaign_completed: "SUCCESS",
};

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const eventType: string = payload.event_type ?? payload.eventType;

    if (!eventType) {
      return NextResponse.json({ received: true });
    }

    const newStatus = EVENT_STATUS_MAP[eventType];
    if (!newStatus) {
      return NextResponse.json({ received: true });
    }

    // Try to find the ContactAttempt by providerRef first
    let attempt = payload.message_id
      ? await prisma.contactAttempt.findFirst({
          where: { providerRef: payload.message_id, channel: "EMAIL" },
        })
      : null;

    // Fallback: find by lead email + campaign
    if (!attempt && payload.lead_email) {
      const lead = await prisma.lead.findFirst({
        where: { email: payload.lead_email },
      });
      if (lead) {
        attempt = await prisma.contactAttempt.findFirst({
          where: {
            leadId: lead.id,
            channel: "EMAIL",
            ...(payload.campaign_id ? { providerRef: payload.campaign_id } : {}),
          },
          orderBy: { startedAt: "desc" },
        });
      }
    }

    if (attempt) {
      const resultData: Record<string, unknown> = attempt.result
        ? JSON.parse(attempt.result)
        : {};

      if (eventType === "email_opened") {
        resultData.opened = true;
        resultData.openedAt = new Date().toISOString();
      } else if (eventType === "link_clicked") {
        resultData.clicked = true;
        resultData.clickedAt = new Date().toISOString();
        resultData.clickUrl = payload.url ?? payload.link_url;
      } else if (eventType === "reply_received") {
        resultData.replied = true;
        resultData.repliedAt = new Date().toISOString();
      }

      await prisma.contactAttempt.update({
        where: { id: attempt.id },
        data: {
          status: newStatus,
          result: JSON.stringify(resultData),
          ...(newStatus === "SUCCESS" || newStatus === "FAILED"
            ? { completedAt: new Date() }
            : {}),
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
