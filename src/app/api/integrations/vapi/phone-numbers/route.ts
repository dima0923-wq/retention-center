import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ data: [], error: "Internal server error" }, { status: 500 });
  }

  const config = await prisma.integrationConfig.findUnique({ where: { provider: "vapi" } });
  if (!config || !config.isActive) {
    return NextResponse.json({ data: [], error: "VAPI not configured" }, { status: 400 });
  }

  let apiKey: string;
  try {
    const parsed = JSON.parse(config.config as string) as { apiKey: string };
    apiKey = parsed.apiKey;
    if (!apiKey) throw new Error("Missing apiKey");
  } catch {
    return NextResponse.json({ data: [], error: "Invalid VAPI configuration — missing apiKey" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.vapi.ai/phone-number", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[VAPI] Phone numbers API error:", res.status, text);
      return NextResponse.json({ data: [], error: `VAPI API error ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const phoneNumbers = Array.isArray(data) ? data : (data.results ?? []);

    return NextResponse.json({
      data: phoneNumbers.map((p: { id: string; number?: string; name?: string; provider?: string; twilioAccountSid?: string; vonageApplicationId?: string }) => ({
        id: p.id,
        number: p.number ?? p.id,
        name: p.name ?? p.number ?? p.id,
        provider: p.provider ?? "vapi",
      })),
    });
  } catch (err) {
    console.error("[VAPI] Phone numbers fetch failed:", err);
    return NextResponse.json({ data: [], error: "Failed to fetch VAPI phone numbers" }, { status: 502 });
  }
}
