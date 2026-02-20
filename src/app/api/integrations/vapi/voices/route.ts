import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse } from "@/lib/api-auth";

type VoiceEntry = { id: string; name: string; provider: string };

const CURATED_VOICES: VoiceEntry[] = [
  // 11labs voices
  ...["Rachel", "Drew", "Clyde", "Paul", "Domi", "Dave", "Fin", "Sarah", "Antoni", "Thomas",
      "Charlie", "George", "Emily", "Elli", "Callum", "Patrick", "Harry", "Liam", "Dorothy",
      "Josh", "Arnold", "Charlotte", "Alice", "Matilda", "James", "Joseph", "Lily", "Chris",
      "Bill", "Daniel", "Jessica", "Eric", "Laura", "Brian", "Nicole"].map((name) => ({
    id: `11labs-${name.toLowerCase()}`,
    name,
    provider: "11labs",
  })),
  // OpenAI voices
  ...["alloy", "echo", "fable", "onyx", "nova", "shimmer"].map((name) => ({
    id: `openai-${name}`,
    name,
    provider: "openai",
  })),
  // PlayHT voices
  ...["Matthew", "Scarlett", "William", "Daisy", "Ariana", "Davis"].map((name) => ({
    id: `playht-${name.toLowerCase()}`,
    name,
    provider: "playht",
  })),
];

export async function GET(req: NextRequest) {
  try {
    await verifyApiAuth(req);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  const config = await prisma.integrationConfig.findUnique({ where: { provider: "vapi" } });
  if (!config || !config.isActive) {
    return NextResponse.json({ error: "VAPI not configured" }, { status: 400 });
  }
  const { apiKey } = JSON.parse(config.config as string) as { apiKey: string };

  try {
    const res = await fetch("https://api.vapi.ai/voice", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.ok) {
      const data = await res.json();
      const voices = Array.isArray(data) ? data : (data.results ?? []);
      if (voices.length > 0) {
        return NextResponse.json(
          voices.map((v: { id?: string; name?: string; provider?: string }) => ({
            id: v.id ?? `${v.provider}-${v.name}`,
            name: v.name ?? v.id ?? "Unknown",
            provider: v.provider ?? "unknown",
          }))
        );
      }
    }
  } catch {
    // Fall through to curated list
  }

  return NextResponse.json(CURATED_VOICES);
}
