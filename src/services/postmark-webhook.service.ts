import { prisma } from "@/lib/db";
import { LeadScoringService } from "./lead-scoring.service";
import { RetentionSequenceService } from "./retention-sequence.service";

// ─── Postmark Event Types ───────────────────────────────────────────────────

type PostmarkBasePayload = {
  RecordType: string;
  MessageID: string;
  [key: string]: unknown;
};

type PostmarkBouncePayload = PostmarkBasePayload & {
  RecordType: "Bounce";
  Type: string; // "HardBounce", "SoftBounce", "Transient", etc.
  TypeCode: number;
  Email: string;
  Description: string;
};

type PostmarkSpamPayload = PostmarkBasePayload & {
  RecordType: "SpamComplaint";
  Email: string;
};

// ─── Score Adjustments ──────────────────────────────────────────────────────

const SCORE_ADJUSTMENTS: Record<string, number> = {
  Delivery: 0,
  Bounce: -15,
  SpamComplaint: -30,
  Open: 5,
  Click: 10,
  SubscriptionChange: -10,
};

// Hard bounce type codes from Postmark docs
const HARD_BOUNCE_CODES = new Set([1, 2, 10, 100]); // HardBounce, Transient, DMARCPolicy, InboundError

// ─── Service ────────────────────────────────────────────────────────────────

export class PostmarkWebhookService {
  /**
   * Validate that the payload has the required Postmark webhook fields.
   */
  static validate(data: unknown): data is PostmarkBasePayload {
    if (!data || typeof data !== "object") return false;
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.MessageID === "string" &&
      obj.MessageID.length > 0 &&
      typeof obj.RecordType === "string" &&
      obj.RecordType.length > 0
    );
  }

  /**
   * Main entry point for processing a Postmark webhook event.
   */
  static async handleEvent(data: PostmarkBasePayload): Promise<void> {
    const { MessageID, RecordType } = data;

    // Idempotency: check if we already processed this exact event
    const existing = await prisma.contactAttempt.findFirst({
      where: { providerRef: MessageID, provider: "postmark" },
      orderBy: { startedAt: "desc" },
    });
    if (!existing) return; // No matching contact attempt — ignore

    // Check idempotency by examining if this event type was already stored
    if (existing.result) {
      try {
        const prevResult = JSON.parse(existing.result) as Record<string, unknown>;
        const processedEvents = (prevResult._processedEvents as string[]) ?? [];
        if (processedEvents.includes(RecordType)) {
          // Already processed this RecordType for this MessageID
          return;
        }
      } catch {
        // result is not valid JSON, continue processing
      }
    }

    // Update contact attempt status and store full payload
    await this.updateContactAttempt(existing.id, existing.result, data);

    // Lead-level side effects
    const leadId = existing.leadId;

    switch (RecordType) {
      case "Delivery":
        // Just update attempt status — no lead-level changes
        break;

      case "Bounce":
        await this.handleBounce(leadId, data as PostmarkBouncePayload);
        break;

      case "SpamComplaint":
        await this.handleSpamComplaint(leadId, data as PostmarkSpamPayload);
        break;

      case "Open":
        await this.adjustLeadScore(leadId, RecordType);
        break;

      case "Click":
        await this.adjustLeadScore(leadId, RecordType);
        break;

      case "SubscriptionChange":
        await this.adjustLeadScore(leadId, RecordType);
        break;

      default:
        // Unknown event type — stored in result but no side effects
        break;
    }

    // Update sequence step execution if this attempt is linked to one
    await this.updateSequenceExecution(existing.id, RecordType);
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Update the ContactAttempt with new status and append the full event payload.
   */
  private static async updateContactAttempt(
    attemptId: string,
    existingResult: string | null,
    data: PostmarkBasePayload
  ): Promise<void> {
    const { RecordType } = data;

    const statusMap: Record<string, string> = {
      Delivery: "SUCCESS",
      Bounce: "FAILED",
      Open: "SUCCESS",
      Click: "SUCCESS",
      SpamComplaint: "FAILED",
      SubscriptionChange: "SUCCESS",
    };
    const newStatus = statusMap[RecordType] ?? "IN_PROGRESS";

    // Build merged result with event tracking for idempotency
    let resultObj: Record<string, unknown> = {};
    if (existingResult) {
      try {
        resultObj = JSON.parse(existingResult) as Record<string, unknown>;
      } catch {
        resultObj = { _previousRaw: existingResult };
      }
    }

    const processedEvents = (resultObj._processedEvents as string[]) ?? [];
    processedEvents.push(RecordType);
    resultObj._processedEvents = processedEvents;
    resultObj[`_event_${RecordType}`] = data;
    resultObj._lastEvent = RecordType;
    resultObj._lastEventAt = new Date().toISOString();

    await prisma.contactAttempt.update({
      where: { id: attemptId },
      data: {
        status: newStatus,
        completedAt: ["SUCCESS", "FAILED"].includes(newStatus) ? new Date() : undefined,
        result: JSON.stringify(resultObj),
      },
    });
  }

  /**
   * Handle bounce events. Hard bounces suppress the lead.
   */
  private static async handleBounce(
    leadId: string,
    data: PostmarkBouncePayload
  ): Promise<void> {
    const isHardBounce = HARD_BOUNCE_CODES.has(data.TypeCode) || data.Type === "HardBounce";

    if (isHardBounce) {
      await this.suppressLead(leadId, "hard_bounce");
    } else {
      // Soft bounce — just decrease score
      await this.adjustLeadScore(leadId, "Bounce");
    }
  }

  /**
   * Handle spam complaint — suppress lead immediately.
   */
  private static async handleSpamComplaint(
    leadId: string,
    _data: PostmarkSpamPayload
  ): Promise<void> {
    await this.suppressLead(leadId, "spam_complaint");
  }

  /**
   * Set lead status to DO_NOT_CONTACT, cancel active enrollments, recalculate score.
   */
  private static async suppressLead(
    leadId: string,
    reason: string
  ): Promise<void> {
    // Update lead status
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "DO_NOT_CONTACT",
        notes: prisma.lead
          ? undefined
          : undefined,
      },
    });

    // Append suppression reason to notes
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { notes: true },
    });
    const existingNotes = lead?.notes ?? "";
    const suppNote = `[${new Date().toISOString()}] Suppressed: ${reason}`;
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        notes: existingNotes ? `${existingNotes}\n${suppNote}` : suppNote,
      },
    });

    // Cancel all active sequence enrollments
    const activeEnrollments = await prisma.sequenceEnrollment.findMany({
      where: { leadId, status: "ACTIVE" },
    });

    for (const enrollment of activeEnrollments) {
      // Cancel pending executions
      await prisma.sequenceStepExecution.updateMany({
        where: {
          enrollmentId: enrollment.id,
          status: { in: ["PENDING", "SCHEDULED"] },
        },
        data: { status: "SKIPPED" },
      });

      await prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
    }

    // Recalculate score (will be 0 / DEAD due to DO_NOT_CONTACT status)
    try {
      await LeadScoringService.calculateScore(leadId);
    } catch {
      // Score calculation is best-effort
    }
  }

  /**
   * Adjust lead score based on the event type.
   */
  private static async adjustLeadScore(
    leadId: string,
    recordType: string
  ): Promise<void> {
    const adjustment = SCORE_ADJUSTMENTS[recordType];
    if (adjustment === undefined || adjustment === 0) return;

    // Recalculate full score (includes all factors)
    // The scoring service considers all contact attempts, so updating the
    // attempt status above is enough for the score to change on recalculation.
    try {
      await LeadScoringService.calculateScore(leadId);
    } catch {
      // Score calculation is best-effort
    }
  }

  /**
   * Update sequence step execution status based on the webhook event.
   */
  private static async updateSequenceExecution(
    contactAttemptId: string,
    recordType: string
  ): Promise<void> {
    const executionStatusMap: Record<string, string> = {
      Delivery: "DELIVERED",
      Bounce: "FAILED",
      SpamComplaint: "FAILED",
    };

    const newExecStatus = executionStatusMap[recordType];
    if (!newExecStatus) return; // Open/Click don't change execution status

    try {
      await RetentionSequenceService.updateStepExecutionByAttempt(
        contactAttemptId,
        {
          status: newExecStatus,
          result: { webhookEvent: recordType, at: new Date().toISOString() },
        }
      );
    } catch {
      // Best-effort — execution may not exist for this attempt
    }
  }
}
