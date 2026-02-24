import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";

type Params = { params: Promise<{ provider: string }> };

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

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
  if (parsed.data.config !== undefined) {
    const existingParsed = existing.config
      ? (JSON.parse(existing.config as string) as Record<string, unknown>)
      : {};
    updateData.config = JSON.stringify(mergeSensitiveFields(parsed.data.config, existingParsed));
  }
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  const updated = await prisma.integrationConfig.update({
    where: { provider },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
