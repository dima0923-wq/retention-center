import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const upsertSchema = z.object({
  provider: z.string().min(1),
  type: z.enum(["CALL", "SMS", "EMAIL"]),
  config: z.record(z.string(), z.unknown()),
  isActive: z.boolean().optional(),
});

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

export async function GET() {
  const configs = await prisma.integrationConfig.findMany({
    orderBy: { provider: "asc" },
  });
  const redacted = configs.map((c) => ({
    ...c,
    config: c.config ? redactSensitiveFields(JSON.parse(c.config as string)) : null,
  }));
  return NextResponse.json(redacted);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { provider, type, config, isActive } = parsed.data;

  // When activating a new integration, deactivate all other integrations of the
  // same type so only one provider per channel type can be active at a time.
  // Skip deactivation if isActive is explicitly set to false.
  if (isActive !== false) {
    await prisma.integrationConfig.updateMany({
      where: { type, provider: { not: provider } },
      data: { isActive: false },
    });
  }

  const integration = await prisma.integrationConfig.upsert({
    where: { provider },
    create: { provider, type, config: JSON.stringify(config), isActive: isActive ?? true },
    update: { type, config: JSON.stringify(config), isActive: isActive ?? true },
  });

  return NextResponse.json(integration);
}
