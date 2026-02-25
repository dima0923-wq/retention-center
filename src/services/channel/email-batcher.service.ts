import type { Lead } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PostmarkService } from "./postmark.service";

type QueuedEmail = {
  attemptId: string;
  lead: Lead;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
  fromEmail?: string;
  fromName?: string;
  tag?: string;
};

const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 5_000;

/**
 * In-memory email batcher that collects emails and flushes them
 * via PostmarkService.batchSendFromQueue in chunks of 50 or after 5s.
 */
export class EmailBatcherService {
  private static queue: QueuedEmail[] = [];
  private static timer: ReturnType<typeof setTimeout> | null = null;

  static addToQueue(
    attemptId: string,
    lead: Lead,
    emailData: {
      subject: string;
      htmlBody: string;
      textBody?: string | null;
      fromEmail?: string;
      fromName?: string;
      tag?: string;
    }
  ): void {
    this.queue.push({ attemptId, lead, ...emailData });

    // Start flush timer if not already running
    if (!this.timer) {
      this.timer = setTimeout(() => {
        void this.flush();
      }, FLUSH_INTERVAL_MS);
    }

    // Auto-flush when batch reaches BATCH_SIZE
    if (this.queue.length >= BATCH_SIZE) {
      void this.flush();
    }
  }

  static async flush(): Promise<Array<{ attemptId: string; success: boolean; providerRef?: string; error?: string }>> {
    // Clear timer
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Take all queued items and clear
    const items = this.queue.splice(0);
    if (items.length === 0) return [];

    // Send via PostmarkService.batchSendFromQueue
    const batchItems = items.map((item) => ({
      lead: item.lead,
      subject: item.subject,
      htmlBody: item.htmlBody,
      textBody: item.textBody,
      fromEmail: item.fromEmail,
      fromName: item.fromName,
      tag: item.tag,
    }));

    const batchResults = await PostmarkService.batchSendFromQueue(batchItems);

    // Map results back to attempts and update DB
    const results: Array<{ attemptId: string; success: boolean; providerRef?: string; error?: string }> = [];

    for (const br of batchResults) {
      const item = items[br.index];
      if (br.providerRef) {
        results.push({ attemptId: item.attemptId, success: true, providerRef: br.providerRef });
        await prisma.contactAttempt.update({
          where: { id: item.attemptId },
          data: { providerRef: br.providerRef, status: "IN_PROGRESS", provider: "postmark" },
        });
      } else {
        results.push({ attemptId: item.attemptId, success: false, error: br.error });
        await prisma.contactAttempt.update({
          where: { id: item.attemptId },
          data: { status: "FAILED", completedAt: new Date(), notes: br.error, provider: "postmark" },
        });
      }
    }

    return results;
  }

  /** Returns current queue length (useful for testing/monitoring). */
  static get queueLength(): number {
    return this.queue.length;
  }

  /** Clear queue without sending (useful for shutdown/testing). */
  static reset(): void {
    this.queue = [];
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
