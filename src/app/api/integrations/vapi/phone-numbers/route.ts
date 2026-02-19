import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const config = await prisma.integrationConfig.findUnique({ where: { provider: "vapi" } });
  if (!config || !config.isActive) {
    return NextResponse.json({ error: "VAPI not configured" }, { status: 400 });
  }
  const { apiKey } = JSON.parse(config.config as string) as { apiKey: string };

  const res = await fetch("https://api.vapi.ai/phone-number", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "VAPI API error", details: text }, { status: res.status });
  }

  const data = await res.json();
  const phoneNumbers = Array.isArray(data) ? data : (data.results ?? []);

  return NextResponse.json(
    phoneNumbers.map((p: { id: string; number?: string; provider?: string }) => ({
      id: p.id,
      number: p.number ?? p.id,
      provider: p.provider ?? "vapi",
    }))
  );
}
