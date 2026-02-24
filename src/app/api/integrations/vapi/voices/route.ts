import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";

type VoiceEntry = { id: string; name: string; provider: string };

const CURATED_VOICES: VoiceEntry[] = [
  // 11labs voices — id = voiceId used by VAPI
  ...["Rachel", "Drew", "Clyde", "Paul", "Domi", "Dave", "Fin", "Sarah", "Antoni", "Thomas",
      "Charlie", "George", "Emily", "Elli", "Callum", "Patrick", "Harry", "Liam", "Dorothy",
      "Josh", "Arnold", "Charlotte", "Alice", "Matilda", "James", "Joseph", "Lily", "Chris",
      "Bill", "Daniel", "Jessica", "Eric", "Laura", "Brian", "Nicole"].map((name) => ({
    id: name.toLowerCase(),
    name,
    provider: "11labs",
  })),
  // OpenAI voices
  ...["alloy", "echo", "fable", "onyx", "nova", "shimmer", "ash", "ballad", "coral", "sage", "verse"].map((name) => ({
    id: name,
    name,
    provider: "openai",
  })),
  // Deepgram voices
  ...["asteria", "luna", "stella", "athena", "hera", "orion", "arcas", "perseus", "angus", "orpheus", "helios", "zeus", "selena"].map((name) => ({
    id: name,
    name,
    provider: "deepgram",
  })),
  // PlayHT voices
  ...["Matthew", "Scarlett", "William", "Daisy", "Ariana", "Davis"].map((name) => ({
    id: name.toLowerCase(),
    name,
    provider: "playht",
  })),
];

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
    const res = await fetch("https://api.vapi.ai/voice", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.ok) {
      const data = await res.json();
      const voices = Array.isArray(data) ? data : (data.results ?? []);
      if (voices.length > 0) {
        return NextResponse.json({
          data: voices.map((v: { id?: string; name?: string; provider?: string }) => ({
            id: v.id ?? `${v.provider}-${v.name}`,
            name: v.name ?? v.id ?? "Unknown",
            provider: v.provider ?? "unknown",
          })),
        });
      }
    }
  } catch {
    console.warn("[VAPI] Voice API not available, returning curated list");
  }

  // VAPI voice endpoint may not exist — return curated list as fallback
  return NextResponse.json({ data: CURATED_VOICES });
}
