import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const config = await prisma.integrationConfig.findUnique({ where: { provider: "vapi" } });
  if (!config || !config.isActive) {
    return NextResponse.json({
      connected: false,
      error: "VAPI not configured or inactive",
      assistantCount: 0,
      phoneNumberCount: 0,
    });
  }

  let apiKey: string;
  try {
    const parsed = JSON.parse(config.config as string) as { apiKey: string; assistantId?: string; phoneNumberId?: string };
    apiKey = parsed.apiKey;
    if (!apiKey) throw new Error("Missing apiKey");
  } catch {
    return NextResponse.json({
      connected: false,
      error: "Invalid VAPI configuration — missing apiKey",
      assistantCount: 0,
      phoneNumberCount: 0,
    });
  }

  try {
    // Fetch assistants and phone numbers in parallel to check connectivity
    const [assistantsRes, phonesRes] = await Promise.all([
      fetch("https://api.vapi.ai/assistant", {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      fetch("https://api.vapi.ai/phone-number", {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    ]);

    if (!assistantsRes.ok && !phonesRes.ok) {
      return NextResponse.json({
        connected: false,
        error: `VAPI API returned ${assistantsRes.status}`,
        assistantCount: 0,
        phoneNumberCount: 0,
      });
    }

    let assistantCount = 0;
    let phoneNumberCount = 0;

    if (assistantsRes.ok) {
      const data = await assistantsRes.json();
      const list = Array.isArray(data) ? data : (data.results ?? []);
      assistantCount = list.length;
    }

    if (phonesRes.ok) {
      const data = await phonesRes.json();
      const list = Array.isArray(data) ? data : (data.results ?? []);
      phoneNumberCount = list.length;
    }

    return NextResponse.json({
      connected: true,
      assistantCount,
      phoneNumberCount,
    });
  } catch (err) {
    console.error("[VAPI] Status check failed:", err);
    return NextResponse.json({
      connected: false,
      error: "Failed to connect to VAPI API",
      assistantCount: 0,
      phoneNumberCount: 0,
    });
  }
}
