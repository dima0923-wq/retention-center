import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const campaignCreateSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  config: z.record(z.string(), z.unknown()).optional(),
});

async function getInstantlyApiKey(): Promise<string | null> {
  const config = await prisma.integrationConfig.findUnique({
    where: { provider: "instantly" },
  });
  if (!config) return null;
  const parsed = JSON.parse(config.config as string);
  return parsed.apiKey ?? null;
}

export async function GET() {
  const apiKey = await getInstantlyApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Instantly integration not configured" },
      { status: 404 }
    );
  }

  const res = await fetch("https://api.instantly.ai/api/v2/campaigns", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "Instantly API error", details: text },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const apiKey = await getInstantlyApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Instantly integration not configured" },
      { status: 404 }
    );
  }

  const rawBody = await req.json();
  const bodyParsed = campaignCreateSchema.safeParse(rawBody);
  if (!bodyParsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: bodyParsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, config } = bodyParsed.data;

  const res = await fetch("https://api.instantly.ai/api/v2/campaigns", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      ...(config ?? {}),
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
