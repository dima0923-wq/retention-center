import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { createSmsProvider } from "@/services/channel/sms.service";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";

const smsSchema = z.object({
  to: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone must be in E.164 format"),
  message: z.string().min(1, "Message is required"),
  provider: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
    const rawBody = await req.json();
    const parsed = smsSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { to, message, provider } = parsed.data;

    // Build where clause — prefer specific provider if given, else any active SMS config
    const whereClause = provider
      ? { provider, isActive: true }
      : { type: "SMS", isActive: true };

    const config = await prisma.integrationConfig.findFirst({
      where: whereClause,
    });

    if (!config) {
      return NextResponse.json(
        { error: "No active SMS integration configured" },
        { status: 400 }
      );
    }

    const smsConfig = (typeof config.config === "string"
      ? JSON.parse(config.config)
      : config.config) as Record<string, unknown>;

    const providerConfig = { provider: config.provider, ...smsConfig } as Parameters<typeof createSmsProvider>[0];
    const smsProvider = createSmsProvider(providerConfig);

    const result = await smsProvider.sendSms(to, message);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Send failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, providerRef: result.providerRef });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/test-send/sms error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
