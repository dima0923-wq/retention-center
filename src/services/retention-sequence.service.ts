import { prisma } from "@/lib/db";
import { ChannelRouterService } from "./channel/channel-router.service";
import { SchedulerService } from "./scheduler.service";

// ─── Types ───────────────────────────────────────────────────────────────────

type StepInput = {
  channel: string;
  scriptId?: string;
  delayValue: number;
  delayUnit: string;
  conditions?: Record<string, unknown>;
  isActive?: boolean;
};

type SequenceCreateInput = {
  name: string;
  description?: string;
  channels?: string[];
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  steps?: StepInput[];
};

type SequenceUpdateInput = {
  name?: string;
  description?: string;
  channels?: string[];
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  status?: string;
  steps?: (StepInput & { id?: string })[];
};

type SequenceFilters = {
  search?: string;
  status?: string;
  triggerType?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

type SequenceStats = {
  totalEnrolled: number;
  active: number;
  completed: number;
  converted: number;
  cancelled: number;
  stepStats: {
    stepId: string;
    stepOrder: number;
    channel: string;
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    skipped: number;
  }[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["PAUSED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

const RETRY_DELAY_MS = 60 * 60 * 1000; // 1 hour

function delayToMs(value: number, unit: string): number {
  switch (unit) {
    case "HOURS":
      return value * 60 * 60 * 1000;
    case "DAYS":
      return value * 24 * 60 * 60 * 1000;
    case "WEEKS":
      return value * 7 * 24 * 60 * 60 * 1000;
    default:
      console.warn(`Unknown delayUnit "${unit}", defaulting to hours`);
      return value * 60 * 60 * 1000;
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class RetentionSequenceService {
  /**
   * Create a new retention sequence with steps.
   */
  static async create(data: SequenceCreateInput) {
    const sequence = await prisma.retentionSequence.create({
      data: {
        name: data.name,
        description: data.description,
        channels: JSON.stringify(data.channels ?? []),
        triggerType: data.triggerType ?? "manual",
        triggerConfig: JSON.stringify(data.triggerConfig ?? {}),
        steps: data.steps?.length
          ? {
              create: data.steps.map((step, index) => ({
                stepOrder: index + 1,
                channel: step.channel,
                scriptId: step.scriptId,
                delayValue: step.delayValue,
                delayUnit: step.delayUnit,
                conditions: JSON.stringify(step.conditions ?? {}),
                isActive: step.isActive ?? true,
              })),
            }
          : undefined,
      },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        _count: { select: { enrollments: true } },
      },
    });

    return sequence;
  }

  /**
   * Update a sequence and optionally replace its steps.
   */
  static async update(id: string, data: SequenceUpdateInput) {
    const existing = await prisma.retentionSequence.findUnique({ where: { id } });
    if (!existing) return null;

    // Validate status transition
    if (data.status && data.status !== existing.status) {
      const allowed = VALID_STATUS_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(data.status)) {
        throw new Error(`Invalid status transition: ${existing.status} -> ${data.status}`);
      }
    }

    // If steps are provided, delete old steps and create new ones — wrap in transaction
    const sequence = await prisma.$transaction(async (tx) => {
      if (data.steps) {
        await tx.sequenceStep.deleteMany({ where: { sequenceId: id } });
      }

      return tx.retentionSequence.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          channels: data.channels ? JSON.stringify(data.channels) : undefined,
          triggerType: data.triggerType,
          triggerConfig: data.triggerConfig ? JSON.stringify(data.triggerConfig) : undefined,
          status: data.status,
          steps: data.steps
            ? {
                create: data.steps.map((step, index) => ({
                  stepOrder: index + 1,
                  channel: step.channel,
                  scriptId: step.scriptId,
                  delayValue: step.delayValue,
                  delayUnit: step.delayUnit,
                  conditions: JSON.stringify(step.conditions ?? {}),
                  isActive: step.isActive ?? true,
                })),
              }
            : undefined,
        },
        include: {
          steps: { orderBy: { stepOrder: "asc" } },
          _count: { select: { enrollments: true } },
        },
      });
    });

    return sequence;
  }

  /**
   * Soft delete (archive) a sequence.
   */
  static async delete(id: string) {
    const existing = await prisma.retentionSequence.findUnique({ where: { id } });
    if (!existing) return null;

    // Cancel all active and paused enrollments
    await prisma.sequenceEnrollment.updateMany({
      where: { sequenceId: id, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { status: "CANCELLED", completedAt: new Date() },
    });

    return prisma.retentionSequence.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
  }

  /**
   * Get sequence by ID with steps and enrollment stats.
   */
  static async getById(id: string) {
    const sequence = await prisma.retentionSequence.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
          include: { script: { select: { id: true, name: true, type: true } } },
        },
        _count: { select: { enrollments: true } },
      },
    });

    if (!sequence) return null;

    // Get enrollment status breakdown
    const enrollmentStats = await prisma.sequenceEnrollment.groupBy({
      by: ["status"],
      where: { sequenceId: id },
      _count: true,
    });

    const byStatus: Record<string, number> = {};
    for (const row of enrollmentStats) {
      byStatus[row.status] = row._count;
    }

    return {
      ...sequence,
      channels: JSON.parse(sequence.channels) as string[],
      triggerConfig: JSON.parse(sequence.triggerConfig) as Record<string, unknown>,
      enrollmentStats: byStatus,
    };
  }

  /**
   * List sequences with pagination and filters.
   */
  static async list(filters: SequenceFilters) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const sortBy = filters.sortBy ?? "createdAt";
    const sortOrder = filters.sortOrder ?? "desc";

    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.triggerType) where.triggerType = filters.triggerType;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.retentionSequence.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          steps: { orderBy: { stepOrder: "asc" } },
          _count: { select: { enrollments: true } },
        },
      }),
      prisma.retentionSequence.count({ where }),
    ]);

    return {
      data: data.map((seq) => ({
        ...seq,
        channels: JSON.parse(seq.channels) as string[],
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Activate a sequence.
   */
  static async activate(id: string) {
    const sequence = await prisma.retentionSequence.findUnique({ where: { id } });
    if (!sequence) return null;

    const allowed = VALID_STATUS_TRANSITIONS[sequence.status] ?? [];
    if (!allowed.includes("ACTIVE")) {
      throw new Error(`Cannot activate sequence in status: ${sequence.status}`);
    }

    // Verify sequence has at least one step
    const stepCount = await prisma.sequenceStep.count({ where: { sequenceId: id } });
    if (stepCount === 0) {
      throw new Error("Cannot activate sequence with no steps");
    }

    return prisma.retentionSequence.update({
      where: { id },
      data: { status: "ACTIVE" },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        _count: { select: { enrollments: true } },
      },
    });
  }

  /**
   * Pause a sequence. Active enrollments are paused as well.
   */
  static async pause(id: string) {
    const sequence = await prisma.retentionSequence.findUnique({ where: { id } });
    if (!sequence) return null;

    const allowed = VALID_STATUS_TRANSITIONS[sequence.status] ?? [];
    if (!allowed.includes("PAUSED")) {
      throw new Error(`Cannot pause sequence in status: ${sequence.status}`);
    }

    // Pause all active enrollments
    await prisma.sequenceEnrollment.updateMany({
      where: { sequenceId: id, status: "ACTIVE" },
      data: { status: "PAUSED" },
    });

    return prisma.retentionSequence.update({
      where: { id },
      data: { status: "PAUSED" },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        _count: { select: { enrollments: true } },
      },
    });
  }

  /**
   * Enroll a lead in a sequence. Creates enrollment and schedules the first step.
   */
  static async enrollLead(sequenceId: string, leadId: string) {
    const sequence = await prisma.retentionSequence.findUnique({
      where: { id: sequenceId },
      include: { steps: { orderBy: { stepOrder: "asc" }, where: { isActive: true } } },
    });

    if (!sequence) throw new Error("Sequence not found");
    if (sequence.status !== "ACTIVE") throw new Error("Sequence is not active");
    if (sequence.steps.length === 0) throw new Error("Sequence has no active steps");

    const firstStep = sequence.steps[0];
    const delayMs = delayToMs(firstStep.delayValue, firstStep.delayUnit);
    const scheduledAt = new Date(Date.now() + delayMs);

    return await prisma.$transaction(async (tx) => {
      // Check if lead is already enrolled
      const existingEnrollment = await tx.sequenceEnrollment.findUnique({
        where: { sequenceId_leadId: { sequenceId, leadId } },
      });

      if (existingEnrollment && existingEnrollment.status === "ACTIVE") {
        throw new Error("Lead is already enrolled in this sequence");
      }

      // If previously enrolled (completed/cancelled), delete old enrollment to allow re-enrollment
      if (existingEnrollment) {
        await tx.sequenceEnrollment.delete({ where: { id: existingEnrollment.id } });
      }

      const enrollment = await tx.sequenceEnrollment.create({
        data: {
          sequenceId,
          leadId,
          status: "ACTIVE",
          currentStep: 0,
        },
      });

      // Schedule the first step execution
      await tx.sequenceStepExecution.create({
        data: {
          enrollmentId: enrollment.id,
          stepId: firstStep.id,
          status: "SCHEDULED",
          scheduledAt,
        },
      });

      return enrollment;
    });
  }

  /**
   * Unenroll (cancel) a lead from a sequence.
   */
  static async unenrollLead(enrollmentId: string) {
    const enrollment = await prisma.sequenceEnrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) throw new Error("Enrollment not found");
    if (enrollment.status !== "ACTIVE" && enrollment.status !== "PAUSED") {
      throw new Error(`Cannot unenroll: enrollment status is ${enrollment.status}`);
    }

    // Cancel pending/scheduled executions
    await prisma.sequenceStepExecution.updateMany({
      where: {
        enrollmentId,
        status: { in: ["PENDING", "SCHEDULED"] },
      },
      data: { status: "SKIPPED" },
    });

    return prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
  }

  /**
   * Execute the next step for an enrollment.
   * Finds the scheduled execution, sends the message, and schedules the following step.
   */
  static async processNextStep(enrollmentId: string): Promise<{ success: boolean; error?: string }> {
    const enrollment = await prisma.sequenceEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        lead: true,
        sequence: {
          include: { steps: { orderBy: { stepOrder: "asc" }, where: { isActive: true } } },
        },
      },
    });

    if (!enrollment) return { success: false, error: "Enrollment not found" };
    if (enrollment.status !== "ACTIVE") return { success: false, error: "Enrollment not active" };

    // Find the pending/scheduled execution for this enrollment that is due
    const execution = await prisma.sequenceStepExecution.findFirst({
      where: {
        enrollmentId,
        status: { in: ["SCHEDULED", "PENDING"] },
        scheduledAt: { lte: new Date() },
      },
      include: { step: true },
      orderBy: { scheduledAt: "asc" },
    });

    if (!execution) return { success: false, error: "No pending execution found" };

    const step = execution.step;
    const lead = enrollment.lead;

    // Check if lead can be contacted (basic validation)
    if (step.channel === "EMAIL" && !lead.email) {
      await this.skipExecution(execution.id, enrollmentId, enrollment.sequence.steps, step.stepOrder);
      return { success: true };
    }
    if ((step.channel === "SMS" || step.channel === "CALL") && !lead.phone) {
      await this.skipExecution(execution.id, enrollmentId, enrollment.sequence.steps, step.stepOrder);
      return { success: true };
    }

    // Parse step conditions for channel-specific config
    let campaignMeta: string | null = null;
    try {
      const conditions = JSON.parse(step.conditions);
      const metaObj: Record<string, unknown> = {};
      if (step.channel === "CALL" && conditions.vapiConfig) {
        metaObj.vapiConfig = conditions.vapiConfig;
      }
      if (step.channel === "EMAIL" && conditions.emailTemplateId) {
        metaObj.emailTemplateId = conditions.emailTemplateId;
      }
      if (Object.keys(metaObj).length > 0) {
        campaignMeta = JSON.stringify(metaObj);
      }
    } catch {}

    // Send message through the channel router
    // We create a synthetic campaign object for the router
    const routeResult = await ChannelRouterService.routeContact(
      lead,
      {
        id: enrollment.sequenceId,
        name: enrollment.sequence.name,
        description: null,
        status: "ACTIVE",
        channels: JSON.stringify([step.channel]),
        meta: campaignMeta,
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      step.channel
    );

    if ("error" in routeResult) {
      // Check if this is a retry
      const meta = JSON.parse(enrollment.meta ?? "{}");
      const retryKey = `retry_${execution.id}`;

      if (!meta[retryKey]) {
        // First failure — schedule retry in 1 hour
        meta[retryKey] = true;
        await prisma.sequenceEnrollment.update({
          where: { id: enrollmentId },
          data: { meta: JSON.stringify(meta) },
        });

        await prisma.sequenceStepExecution.update({
          where: { id: execution.id },
          data: {
            status: "SCHEDULED",
            scheduledAt: new Date(Date.now() + RETRY_DELAY_MS),
            result: JSON.stringify({ error: routeResult.error, retrying: true }),
          },
        });

        return { success: false, error: `Step failed, retrying in 1 hour: ${routeResult.error}` };
      }

      // Second failure — skip this step and move to next
      await this.skipExecution(execution.id, enrollmentId, enrollment.sequence.steps, step.stepOrder);
      return { success: false, error: `Step failed after retry, skipping: ${routeResult.error}` };
    }

    // Success — mark execution as sent, link to contact attempt
    await prisma.sequenceStepExecution.update({
      where: { id: execution.id },
      data: {
        status: "SENT",
        executedAt: new Date(),
        contactAttemptId: routeResult.attemptId,
        result: JSON.stringify({ attemptId: routeResult.attemptId }),
      },
    });

    // Update enrollment progress
    const currentStepIndex = enrollment.sequence.steps.findIndex((s) => s.id === step.id);
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        currentStep: currentStepIndex + 1,
        lastStepAt: new Date(),
      },
    });

    // Schedule next step if exists
    await this.scheduleNextStep(enrollmentId, enrollment.sequence.steps, step.stepOrder);

    return { success: true };
  }

  /**
   * MAIN CRON METHOD: Find all enrollments where next step is due and process them.
   */
  static async checkAndAdvanceEnrollments(): Promise<{ processed: number; errors: string[] }> {
    const now = new Date();

    // Find all due executions (scheduled and past due)
    const dueExecutions = await prisma.sequenceStepExecution.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: now },
        enrollment: { status: "ACTIVE" },
      },
      include: {
        enrollment: {
          include: { sequence: { select: { status: true } } },
        },
      },
      take: 100,
      orderBy: { scheduledAt: "asc" },
    });

    let processed = 0;
    const errors: string[] = [];

    for (const execution of dueExecutions) {
      // Skip if sequence is no longer active
      if (execution.enrollment.sequence.status !== "ACTIVE") {
        continue;
      }

      const result = await this.processNextStep(execution.enrollmentId);

      if (result.success) {
        processed++;
      } else if (result.error) {
        errors.push(`Enrollment ${execution.enrollmentId}: ${result.error}`);
      }
    }

    return { processed, errors };
  }

  /**
   * Get performance stats for a sequence.
   */
  static async getSequenceStats(id: string): Promise<SequenceStats | null> {
    const sequence = await prisma.retentionSequence.findUnique({
      where: { id },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    if (!sequence) return null;

    // Enrollment stats
    const enrollmentStats = await prisma.sequenceEnrollment.groupBy({
      by: ["status"],
      where: { sequenceId: id },
      _count: true,
    });

    const statusMap: Record<string, number> = {};
    let totalEnrolled = 0;
    for (const row of enrollmentStats) {
      statusMap[row.status] = row._count;
      totalEnrolled += row._count;
    }

    // Per-step execution stats
    const stepStats = [];
    for (const step of sequence.steps) {
      const executions = await prisma.sequenceStepExecution.groupBy({
        by: ["status"],
        where: { stepId: step.id },
        _count: true,
      });

      const execMap: Record<string, number> = {};
      let total = 0;
      for (const row of executions) {
        execMap[row.status] = row._count;
        total += row._count;
      }

      stepStats.push({
        stepId: step.id,
        stepOrder: step.stepOrder,
        channel: step.channel,
        total,
        sent: (execMap["SENT"] ?? 0) + (execMap["DELIVERED"] ?? 0),
        delivered: execMap["DELIVERED"] ?? 0,
        failed: execMap["FAILED"] ?? 0,
        skipped: execMap["SKIPPED"] ?? 0,
      });
    }

    return {
      totalEnrolled,
      active: statusMap["ACTIVE"] ?? 0,
      completed: statusMap["COMPLETED"] ?? 0,
      converted: statusMap["CONVERTED"] ?? 0,
      cancelled: statusMap["CANCELLED"] ?? 0,
      stepStats,
    };
  }

  /**
   * Mark a lead's enrollment as CONVERTED (called when conversion webhook fires).
   */
  static async markConverted(leadId: string, sequenceId?: string) {
    const where: Record<string, unknown> = {
      leadId,
      status: "ACTIVE",
    };
    if (sequenceId) where.sequenceId = sequenceId;

    const enrollments = await prisma.sequenceEnrollment.findMany({ where });

    for (const enrollment of enrollments) {
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
        data: { status: "CONVERTED", completedAt: new Date() },
      });
    }

    return { converted: enrollments.length };
  }

  /**
   * Auto-enroll a lead in all matching active sequences based on triggerType and source filters.
   */
  static async autoEnrollByTrigger(
    leadId: string,
    triggerType: string,
    source?: string
  ): Promise<{ enrolled: string[] }> {
    const sequences = await prisma.retentionSequence.findMany({
      where: { status: "ACTIVE", triggerType },
    });

    const enrolled: string[] = [];

    for (const seq of sequences) {
      // Check source filter in triggerConfig
      const config = JSON.parse(seq.triggerConfig) as Record<string, unknown>;
      if (config.sources && Array.isArray(config.sources) && source) {
        if (!(config.sources as string[]).includes(source)) continue;
      }

      try {
        await this.enrollLead(seq.id, leadId);
        enrolled.push(seq.id);
      } catch {
        // Already enrolled or sequence validation failed — skip silently
      }
    }

    return { enrolled };
  }

  /**
   * Update a sequence step execution's result with external data (e.g., email open, call result).
   */
  static async updateStepExecutionByAttempt(
    contactAttemptId: string,
    data: { status?: string; result?: Record<string, unknown> }
  ) {
    const execution = await prisma.sequenceStepExecution.findFirst({
      where: { contactAttemptId },
    });

    if (!execution) return null;

    const updateData: Record<string, unknown> = {};
    if (data.status) updateData.status = data.status;
    if (data.result) {
      const existing = JSON.parse(execution.result) as Record<string, unknown>;
      updateData.result = JSON.stringify({ ...existing, ...data.result });
    }

    if (Object.keys(updateData).length === 0) return execution;

    return prisma.sequenceStepExecution.update({
      where: { id: execution.id },
      data: updateData,
    });
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Skip an execution and schedule the next step if available.
   */
  private static async skipExecution(
    executionId: string,
    enrollmentId: string,
    steps: { id: string; stepOrder: number; delayValue: number; delayUnit: string }[],
    currentStepOrder: number
  ) {
    await prisma.sequenceStepExecution.update({
      where: { id: executionId },
      data: { status: "SKIPPED", executedAt: new Date() },
    });

    await this.scheduleNextStep(enrollmentId, steps, currentStepOrder);
  }

  /**
   * Schedule the next step in the sequence after the current step order.
   * If no more steps, mark enrollment as completed.
   */
  private static async scheduleNextStep(
    enrollmentId: string,
    steps: { id: string; stepOrder: number; delayValue: number; delayUnit: string }[],
    currentStepOrder: number
  ) {
    const nextStep = steps.find((s) => s.stepOrder > currentStepOrder);

    if (!nextStep) {
      // No more steps — mark enrollment as completed
      await prisma.sequenceEnrollment.update({
        where: { id: enrollmentId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      return;
    }

    const delayMs = delayToMs(nextStep.delayValue, nextStep.delayUnit);
    const scheduledAt = new Date(Date.now() + delayMs);

    await prisma.sequenceStepExecution.create({
      data: {
        enrollmentId,
        stepId: nextStep.id,
        status: "SCHEDULED",
        scheduledAt,
      },
    });
  }
}
