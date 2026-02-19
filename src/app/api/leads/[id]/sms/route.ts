import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { sendSmsToLead } from "@/services/channel/sms.service";

const sendSmsSchema = z.object({
  message: z.string().min(1, "Message is required"),
  scriptId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate body first
    const body = await request.json();
    const parsed = sendSmsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Look up lead
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Check status
    if (lead.status === "DO_NOT_CONTACT") {
      return NextResponse.json(
        { error: "Cannot send SMS to a lead with DO_NOT_CONTACT status" },
        { status: 400 }
      );
    }

    if (!lead.phone) {
      return NextResponse.json(
        { error: "Lead has no phone number" },
        { status: 400 }
      );
    }

    const { message, scriptId } = parsed.data;

    // Delegate to SMS service (handles provider selection, sending, ContactAttempt recording)
    const result = await sendSmsToLead(id, message, scriptId);

    if ("error" in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      attemptId: result.attemptId,
      providerRef: result.providerRef,
    });
  } catch (error) {
    console.error("POST /api/leads/[id]/sms error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
