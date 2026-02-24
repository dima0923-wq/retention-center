import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PostmarkService } from "@/services/channel/postmark.service";
import { verifyApiAuth, AuthError, authErrorResponse , requirePermission } from "@/lib/api-auth";

const emailSchema = z.object({
  to: z.string().email("Valid email is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  fromEmail: z.string().email().optional(),
  fromName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    requirePermission(user, 'retention:templates:manage');
    const rawBody = await req.json();
    const parsed = emailSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { to, subject, body, fromEmail, fromName } = parsed.data;

    // Create a minimal lead object for PostmarkService
    const fakeLead = {
      id: "test",
      externalId: null,
      firstName: "Test",
      lastName: "User",
      phone: null,
      email: to,
      source: "test",
      status: "NEW",
      meta: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await PostmarkService.sendEmail(
      fakeLead as Parameters<typeof PostmarkService.sendEmail>[0],
      {
        subject,
        htmlBody: body,
        fromEmail,
        fromName,
      },
      { tag: "test-send" }
    );

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      messageId: result.providerRef,
      note: "Test email sent via Postmark.",
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/test-send/postmark-email error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
