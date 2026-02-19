import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

type Params = { params: Promise<{ provider: string }> };

function redactSensitiveFields(config: Record<string, unknown>) {
  const sensitiveKeys = ["apiKey", "api_key", "password", "secret", "token"];
  const result = { ...config };
  for (const key of sensitiveKeys) {
    if (key in result && typeof result[key] === "string") {
      result[key] = "***";
    }
  }
  return result;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { provider } = await params;
  const config = await prisma.integrationConfig.findUnique({
    where: { provider },
  });
  if (!config) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const redacted = {
    ...config,
    config: config.config ? redactSensitiveFields(JSON.parse(config.config as string)) : null,
  };
  return NextResponse.json(redacted);
}

const patchSchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const { provider } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.integrationConfig.findUnique({
    where: { provider },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.config !== undefined) updateData.config = JSON.stringify(parsed.data.config);
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  const updated = await prisma.integrationConfig.update({
    where: { provider },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { provider } = await params;
  const existing = await prisma.integrationConfig.findUnique({
    where: { provider },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.integrationConfig.update({
    where: { provider },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
