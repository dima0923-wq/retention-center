import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ALL_EVENTS = [
  "email_sent",
  "email_opened",
  "reply_received",
  "link_clicked",
  "email_bounced",
  "lead_unsubscribed",
  "campaign_completed",
];

async function getInstantlyApiKey(): Promise<string | null> {
  const config = await prisma.integrationConfig.findUnique({
    where: { provider: "instantly" },
  });
  if (!config) return null;
  const parsed = JSON.parse(config.config as string);
  return parsed.apiKey ?? null;
}

export async function POST(req: NextRequest) {
  const apiKey = await getInstantlyApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Instantly integration not configured" },
      { status: 404 }
    );
  }

  const body = await req.json();

  // Auto-register all event types at once
  if (body.auto) {
    const baseUrl = body.webhook_url;
    if (!baseUrl) {
      return NextResponse.json(
        { error: "webhook_url is required" },
        { status: 400 }
      );
    }

    const results = await Promise.allSettled(
      ALL_EVENTS.map(async (eventType) => {
        const res = await fetch("https://api.instantly.ai/api/v2/webhooks", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ event_type: eventType, webhook_url: baseUrl }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${eventType}: ${text}`);
        }
        return { eventType, data: await res.json() };
      })
    );

    return NextResponse.json({
      results: results.map((r, i) => ({
        event: ALL_EVENTS[i],
        status: r.status,
        ...(r.status === "fulfilled" ? { data: r.value.data } : { error: (r as PromiseRejectedResult).reason?.message }),
      })),
    });
  }

  // Register a single webhook
  if (!body.event_type || !body.webhook_url) {
    return NextResponse.json(
      { error: "event_type and webhook_url are required" },
      { status: 400 }
    );
  }

  const res = await fetch("https://api.instantly.ai/api/v2/webhooks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: body.event_type,
      webhook_url: body.webhook_url,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "Instantly API error", details: text },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data, { status: 201 });
}
