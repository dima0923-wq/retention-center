import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

  const res = await fetch("https://api.instantly.ai/api/v2/accounts", {
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
