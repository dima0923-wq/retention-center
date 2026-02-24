import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { VapiService, type VapiWebhookPayload } from "@/services/channel/vapi.service";
import { RetentionSequenceService } from "@/services/retention-sequence.service";

export async function POST(req: NextRequest) {
  let payload: VapiWebhookPayload;

  try {
    const data = await req.json();
    // VAPI webhooks send { message: { type, call, ... } }
    // Normalize to the shape handleCallback expects
    payload = (data.message ?? data) as VapiWebhookPayload;
  } catch (err) {
    console.error("[VAPI Webhook] Failed to parse request body:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload.type ?? "unknown";
  const callId = payload.call?.id ?? "no-call-id";
  const callStatus = payload.call?.status;

  // Log all incoming webhook events for debugging
  console.log(
    `[VAPI Webhook] event=${eventType} callId=${callId} callStatus=${callStatus ?? "n/a"}`
  );

  try {
    switch (eventType) {
      // Call lifecycle events — update contact attempt
      case "call-started":
      case "call-ended":
      case "call-failed":
      case "end-of-call-report":
      case "status-update":
        await VapiService.handleCallback(payload);
        break;

      // Speech events — log only (could be used for real-time monitoring later)
      case "speech-update":
        console.log(
          `[VAPI Webhook] speech-update callId=${callId} role=${payload.role} status=${payload.status}`
        );
        break;

      // Transcript events — log only
      case "transcript":
        console.log(
          `[VAPI Webhook] transcript callId=${callId} type=${payload.transcriptType}`
        );
        break;

      // Hang event — treat as call ended
      case "hang":
        console.log(`[VAPI Webhook] hang callId=${callId}`);
        await VapiService.handleCallback(payload);
        break;

      default:
        // Handle any event that carries call status data
        if (payload.call?.status) {
          await VapiService.handleCallback(payload);
        }
        break;
    }

    // Update sequence step execution if this call is part of a sequence
    if (payload.call?.id) {
      const isCompleted = callStatus === "ended" || callStatus === "completed";
      const isFailed = callStatus === "failed" || callStatus === "no-answer";

      if (isCompleted || isFailed) {
        const attempt = await prisma.contactAttempt.findFirst({
          where: { providerRef: payload.call.id },
          select: { id: true, result: true },
        });

        if (attempt) {
          // Parse result to pass recording URL and outcome to sequence
          let resultData: Record<string, unknown> = {
            callStatus,
            duration: payload.call.duration,
            cost: payload.call.cost,
          };

          try {
            if (attempt.result) {
              const parsed = JSON.parse(attempt.result as string) as Record<string, unknown>;
              if (parsed.recordingUrl) resultData.recordingUrl = parsed.recordingUrl;
              if (parsed.outcome) resultData.outcome = parsed.outcome;
              if (parsed.keywords) resultData.keywords = parsed.keywords;
            }
          } catch {
            // result wasn't valid JSON, use basic data
          }

          RetentionSequenceService.updateStepExecutionByAttempt(attempt.id, {
            status: isCompleted ? "DELIVERED" : "FAILED",
            result: resultData,
          }).catch((err) => {
            console.error(
              `[VAPI Webhook] Failed to update sequence step for attempt ${attempt.id}:`,
              err
            );
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[VAPI Webhook] Error processing event=${eventType} callId=${callId}:`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
