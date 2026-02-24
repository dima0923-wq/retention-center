import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";

const upsertSchema = z.object({
  provider: z.string().min(1),
  type: z.enum(["CALL", "SMS", "EMAIL", "META_CAPI"]),
  config: z.record(z.string(), z.unknown()),
  isActive: z.boolean().optional(),
});

const SENSITIVE_KEYS = ["apiKey", "api_key", "password", "secret", "token", "accessToken"];
const SENSITIVE_PLACEHOLDER = "***";

function redactSensitiveFields(config: Record<string, unknown>) {
  const result = { ...config };
  for (const key of SENSITIVE_KEYS) {
    if (key in result && typeof result[key] === "string") {
      result[key] = SENSITIVE_PLACEHOLDER;
    }
  }
  return result;
}

/** Merge incoming config with existing DB config, preserving sensitive fields that were redacted. */
function mergeSensitiveFields(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...incoming };
  for (const key of SENSITIVE_KEYS) {
    if (merged[key] === SENSITIVE_PLACEHOLDER && key in existing) {
      merged[key] = existing[key];
    }
  }
  return merged;
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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

  // Preserve redacted sensitive fields (e.g. password="***") by merging with existing DB values
  let finalConfig = config;
  const existing = await prisma.integrationConfig.findUnique({ where: { provider } });
  if (existing?.config) {
    const existingParsed = JSON.parse(existing.config as string) as Record<string, unknown>;
    finalConfig = mergeSensitiveFields(config, existingParsed);
  }

  const integration = await prisma.integrationConfig.upsert({
    where: { provider },
    create: { provider, type, config: JSON.stringify(finalConfig), isActive: isActive ?? true },
    update: { type, config: JSON.stringify(finalConfig), isActive: isActive ?? true },
  });

  return NextResponse.json(integration);
}
