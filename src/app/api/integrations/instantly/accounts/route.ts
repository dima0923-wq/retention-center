import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";

async function getInstantlyApiKey(): Promise<string | null> {
  const config = await prisma.integrationConfig.findUnique({
    where: { provider: "instantly" },
  });
  if (!config) return null;
  const parsed = JSON.parse(config.config as string);
  return parsed.apiKey ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
