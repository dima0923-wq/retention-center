import { prisma } from "@/lib/db";
import { RetentionSequenceService } from "./retention-sequence.service";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProcessorResult = {
  processed: number;
  enrolled: number;
  errors: string[];
};

// ─── Service ─────────────────────────────────────────────────────────────────

export class SequenceProcessorService {
  /**
   * Main entry point — called by the CRON endpoint.
   * Runs all processor tasks and returns aggregated stats.
   */
  static async runAll(): Promise<ProcessorResult> {
    const errors: string[] = [];
    let processed = 0;
    let enrolled = 0;

    // 1. Process all due steps
    try {
      const stepResult = await this.processAllDueSteps();
      processed = stepResult.processed;
      errors.push(...stepResult.errors);
    } catch (err) {
      errors.push(`processAllDueSteps failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Auto-enroll new leads matching sequence triggers
    try {
      const enrollResult = await this.autoEnrollNewLeads();
      enrolled = enrollResult.enrolled;
      errors.push(...enrollResult.errors);
    } catch (err) {
      errors.push(`autoEnrollNewLeads failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { processed, enrolled, errors };
  }

  /**
   * Find all enrollments where the next step is due and process them.
   * Delegates to RetentionSequenceService.checkAndAdvanceEnrollments().
   */
  static async processAllDueSteps(): Promise<{ processed: number; errors: string[] }> {
    return RetentionSequenceService.checkAndAdvanceEnrollments();
  }

  /**
   * Check for new leads matching sequence auto-enrollment triggers.
   * For sequences with triggerType="new_lead", find leads created since the last check
   * and enroll them if they match the trigger filters.
   */
  static async autoEnrollNewLeads(): Promise<{ enrolled: number; errors: string[] }> {
    let enrolled = 0;
    const errors: string[] = [];

    // Find all active sequences with auto-enrollment triggers
    const sequences = await prisma.retentionSequence.findMany({
      where: {
        status: "ACTIVE",
        triggerType: { in: ["new_lead", "no_conversion"] },
      },
      include: {
        steps: { where: { isActive: true }, orderBy: { stepOrder: "asc" } },
      },
    });

    for (const sequence of sequences) {
      if (sequence.steps.length === 0) continue;

      try {
        const triggerConfig = JSON.parse(sequence.triggerConfig) as Record<string, unknown>;

        // Determine lookback window — default 15 minutes for CRON frequency
        const lookbackMinutes = (triggerConfig.lookbackMinutes as number) ?? 15;
        const since = new Date(Date.now() - lookbackMinutes * 60 * 1000);

        // Build lead query filters from triggerConfig
        const leadWhere: Record<string, unknown> = {
          createdAt: { gte: since },
        };

        if (triggerConfig.source) {
          leadWhere.source = triggerConfig.source;
        }

        if (triggerConfig.status) {
          leadWhere.status = triggerConfig.status;
        }

        // For "no_conversion" trigger, find leads without any conversion
        if (sequence.triggerType === "no_conversion") {
          const minAge = (triggerConfig.minAgeHours as number) ?? 24;
          const cutoff = new Date(Date.now() - minAge * 60 * 60 * 1000);
          leadWhere.createdAt = { lte: cutoff };
        }

        const matchingLeads = await prisma.lead.findMany({
          where: leadWhere,
          select: { id: true },
          take: 200, // Batch limit per run
        });

        // Batch fetch existing enrollments to avoid N+1 queries
        const existingEnrollments = await prisma.sequenceEnrollment.findMany({
          where: { sequenceId: sequence.id, leadId: { in: matchingLeads.map((l) => l.id) } },
          select: { leadId: true, status: true },
        });
        const activeEnrolledLeadIds = new Set(
          existingEnrollments.filter((e) => e.status === "ACTIVE").map((e) => e.leadId)
        );

        for (const lead of matchingLeads) {
          if (activeEnrolledLeadIds.has(lead.id)) continue;

          // For "no_conversion" trigger, verify lead has no conversions
          if (sequence.triggerType === "no_conversion") {
            const conversionCount = await prisma.conversion.count({
              where: { leadId: lead.id },
            });
            if (conversionCount > 0) continue;
          }

          try {
            await RetentionSequenceService.enrollLead(sequence.id, lead.id);
            enrolled++;
          } catch (err) {
            errors.push(
              `Auto-enroll lead ${lead.id} in sequence ${sequence.id}: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        }
      } catch (err) {
        errors.push(
          `Processing sequence ${sequence.id} triggers: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    return { enrolled, errors };
  }

  /**
   * Handle a conversion event for a lead.
   * Marks all active enrollments as CONVERTED and stops future steps.
   */
  static async handleConversion(leadId: string, sequenceId?: string) {
    return RetentionSequenceService.markConverted(leadId, sequenceId);
  }
}
