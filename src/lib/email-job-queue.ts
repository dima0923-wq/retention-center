import { prisma } from "@/lib/db";

type EmailJobPayload = {
  attemptId: string;
  leadId: string;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
  fromEmail?: string;
  fromName?: string;
  tag?: string;
};

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 5_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let processing = false;

/**
 * Enqueue an email job into the persistent SQLite-backed queue.
 * Survives server restarts — jobs are stored in DB.
 */
export async function enqueueEmailJob(payload: EmailJobPayload): Promise<string> {
  const job = await prisma.emailJob.create({
    data: {
      payload: JSON.stringify(payload),
      status: "pending",
    },
  });
  return job.id;
}

/**
 * Process pending email jobs in batches. Called by the poll loop.
 */
export async function processEmailJobs(): Promise<number> {
  if (processing) return 0;
  processing = true;

  try {
    const jobs = await prisma.emailJob.findMany({
      where: {
        status: { in: ["pending", "processing"] },
      },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    });

    if (jobs.length === 0) return 0;

    // Mark as processing
    const jobIds = jobs.map((j) => j.id);
    await prisma.emailJob.updateMany({
      where: { id: { in: jobIds } },
      data: { status: "processing", attempts: { increment: 1 } },
    });

    // Dynamically import to avoid circular deps
    const { PostmarkService } = await import("@/services/channel/postmark.service");
    const { isEmailSuppressed } = await import("@/lib/suppression");

    const items: Array<{
      jobId: string;
      attemptId: string;
      lead: Awaited<ReturnType<typeof prisma.lead.findUnique>>;
      subject: string;
      htmlBody: string;
      textBody?: string | null;
      fromEmail?: string;
      fromName?: string;
      tag?: string;
    }> = [];

    for (const job of jobs) {
      const payload = JSON.parse(job.payload) as EmailJobPayload;
      const lead = await prisma.lead.findUnique({ where: { id: payload.leadId } });
      if (!lead) {
        await prisma.emailJob.update({
          where: { id: job.id },
          data: { status: "failed", error: "Lead not found", processedAt: new Date() },
        });
        continue;
      }

      // Check suppression
      if (lead.email && await isEmailSuppressed(lead.email)) {
        await prisma.emailJob.update({
          where: { id: job.id },
          data: { status: "failed", error: "Email suppressed", processedAt: new Date() },
        });
        await prisma.contactAttempt.update({
          where: { id: payload.attemptId },
          data: { status: "FAILED", completedAt: new Date(), notes: "Email suppressed (bounce/unsubscribe)" },
        }).catch(() => {});
        continue;
      }

      items.push({
        jobId: job.id,
        attemptId: payload.attemptId,
        lead,
        subject: payload.subject,
        htmlBody: payload.htmlBody,
        textBody: payload.textBody,
        fromEmail: payload.fromEmail,
        fromName: payload.fromName,
        tag: payload.tag,
      });
    }

    if (items.length === 0) return 0;

    // Send via Postmark batch
    const batchItems = items.map((item) => ({
      lead: item.lead!,
      subject: item.subject,
      htmlBody: item.htmlBody,
      textBody: item.textBody,
      fromEmail: item.fromEmail,
      fromName: item.fromName,
      tag: item.tag,
    }));

    const batchResults = await PostmarkService.batchSendFromQueue(batchItems);

    // Update job and attempt statuses
    for (const br of batchResults) {
      const item = items[br.index];
      if (br.providerRef) {
        await prisma.emailJob.update({
          where: { id: item.jobId },
          data: { status: "completed", processedAt: new Date() },
        });
        await prisma.contactAttempt.update({
          where: { id: item.attemptId },
          data: { providerRef: br.providerRef, status: "IN_PROGRESS", provider: "postmark" },
        }).catch(() => {});
      } else {
        const job = jobs.find((j) => j.id === item.jobId);
        const attempts = (job?.attempts ?? 0) + 1;
        const maxAttempts = job?.maxAttempts ?? 3;
        const isFinal = attempts >= maxAttempts;

        await prisma.emailJob.update({
          where: { id: item.jobId },
          data: {
            status: isFinal ? "failed" : "pending",
            error: br.error,
            processedAt: isFinal ? new Date() : undefined,
          },
        });
        if (isFinal) {
          await prisma.contactAttempt.update({
            where: { id: item.attemptId },
            data: { status: "FAILED", completedAt: new Date(), notes: br.error, provider: "postmark" },
          }).catch(() => {});
        }
      }
    }

    return batchResults.length;
  } finally {
    processing = false;
  }
}

/**
 * Start the email job polling loop. Call on server startup.
 */
export function startEmailJobProcessor(): void {
  if (pollTimer) return;
  // Resume any jobs stuck in "processing" from a previous crash
  void prisma.emailJob.updateMany({
    where: { status: "processing" },
    data: { status: "pending" },
  }).then((result) => {
    if (result.count > 0) {
      console.log(`[EmailJobQueue] Recovered ${result.count} stuck jobs from previous crash`);
    }
  });

  pollTimer = setInterval(() => {
    void processEmailJobs();
  }, POLL_INTERVAL_MS);
  console.log("[EmailJobQueue] Started persistent email job processor");
}

/**
 * Stop the email job polling loop.
 */
export function stopEmailJobProcessor(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
