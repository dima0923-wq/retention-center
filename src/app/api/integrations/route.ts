import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const upsertSchema = z.object({
  provider: z.string().min(1),
  type: z.enum(["CALL", "SMS", "EMAIL"]),
  config: z.record(z.string(), z.unknown()),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const configs = await prisma.integrationConfig.findMany({
    orderBy: { provider: "asc" },
  });
  return NextResponse.json(configs);
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

  // Deactivate other integrations of the same type when activating a new one
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
