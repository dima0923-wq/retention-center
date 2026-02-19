import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { VapiService } from "@/services/channel/vapi.service";
import { RetentionSequenceService } from "@/services/retention-sequence.service";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // VAPI webhooks send { message: { type, call, ... } }
    // Normalize to the shape handleCallback expects: { type, call }
    const payload = data.message ?? data;

    await VapiService.handleCallback(payload);

    // Update sequence step execution if this call is part of a sequence
    if (payload.call?.id) {
      const callStatus = payload.call.status;
      const isCompleted = callStatus === "ended" || callStatus === "completed";
      const isFailed = callStatus === "failed" || callStatus === "no-answer";

      if (isCompleted || isFailed) {
        const attempt = await prisma.contactAttempt.findFirst({
          where: { providerRef: payload.call.id },
          select: { id: true },
        });

        if (attempt) {
          RetentionSequenceService.updateStepExecutionByAttempt(attempt.id, {
            status: isCompleted ? "DELIVERED" : "FAILED",
            result: {
              callStatus,
              duration: payload.call.duration,
              cost: payload.call.cost,
            },
          }).catch(() => {
            // Silently ignore — attempt may not be part of a sequence
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
