import { prisma } from "@/lib/db";

export class CleanupService {
  /**
   * Delete VapiCallLog records older than retentionDays.
   */
  static async cleanupVapiCallLogs(retentionDays = 30): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.vapiCallLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    console.log(`[Cleanup] Deleted ${result.count} VapiCallLog records older than ${retentionDays} days`);
    return { deleted: result.count };
  }

  /**
   * Delete SmsDeliveryEvent records older than retentionDays.
   */
  static async cleanupSmsDeliveryEvents(retentionDays = 90): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.smsDeliveryEvent.deleteMany({
      where: { receivedAt: { lt: cutoff } },
    });
    console.log(`[Cleanup] Deleted ${result.count} SmsDeliveryEvent records older than ${retentionDays} days`);
    return { deleted: result.count };
  }

  /**
   * Delete completed/failed/skipped SequenceStepExecution records older than retentionDays.
   * Only deletes terminal-state executions to preserve in-progress data.
   */
  static async cleanupOldSequenceExecutions(retentionDays = 90): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.sequenceStepExecution.deleteMany({
      where: {
        status: { in: ["COMPLETED", "FAILED", "SKIPPED", "DELIVERED", "SENT"] },
        executedAt: { lt: cutoff },
      },
    });
    console.log(`[Cleanup] Deleted ${result.count} SequenceStepExecution records older than ${retentionDays} days`);
    return { deleted: result.count };
  }

  /**
   * Run all cleanup jobs and return aggregate stats.
   */
  static async runAll(): Promise<{ vapiLogs: number; smsEvents: number; seqExecutions: number }> {
    const [vapi, sms, seq] = await Promise.all([
      this.cleanupVapiCallLogs(),
      this.cleanupSmsDeliveryEvents(),
      this.cleanupOldSequenceExecutions(),
    ]);
    return {
      vapiLogs: vapi.deleted,
      smsEvents: sms.deleted,
      seqExecutions: seq.deleted,
    };
  }
}
