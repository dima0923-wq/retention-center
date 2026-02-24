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
    const res = await fetch("https://api.vapi.ai/assistant", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[VAPI] Assistants API error:", res.status, text);
      return NextResponse.json({ data: [], error: `VAPI API error ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const assistants = Array.isArray(data) ? data : (data.results ?? []);

    return NextResponse.json({
      data: assistants.map((a: Record<string, unknown>) => {
        const model = (a.model ?? {}) as Record<string, unknown>;
        const voice = (a.voice ?? {}) as Record<string, unknown>;
        const messages = (model.messages ?? []) as { role: string; content: string }[];
        const systemMsg = messages.find((m) => m.role === "system");
        return {
          id: a.id,
          name: a.name ?? a.id,
          model: model.model ?? null,
          modelProvider: model.provider ?? null,
          temperature: model.temperature ?? null,
          voiceProvider: voice.provider ?? null,
          voiceId: voice.voiceId ?? null,
          firstMessage: a.firstMessage ?? null,
          instructions: a.instructions ?? systemMsg?.content ?? null,
        };
      }),
    });
  } catch (err) {
    console.error("[VAPI] Assistants fetch failed:", err);
    return NextResponse.json({ data: [], error: "Failed to fetch VAPI assistants" }, { status: 502 });
  }
}
