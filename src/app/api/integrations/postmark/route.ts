import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";

const SENSITIVE_KEYS = ["serverToken"];
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

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const config = await prisma.integrationConfig.findUnique({
    where: { provider: "postmark" },
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
