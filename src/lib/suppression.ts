import { prisma } from "@/lib/db";

/**
 * Check if an email address is suppressed (bounced, unsubscribed, complained).
 */
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const suppressed = await prisma.suppressedEmail.findUnique({
    where: { email: email.toLowerCase() },
  });
  return suppressed !== null;
}

/**
 * Add an email to the suppression list.
 * Upserts — if already suppressed, updates reason.
 */
export async function suppressEmail(
  email: string,
  reason: string,
  source: string = "webhook"
): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  await prisma.suppressedEmail.upsert({
    where: { email: normalizedEmail },
    create: { email: normalizedEmail, reason, source },
    update: { reason, source, suppressedAt: new Date() },
  });
}

/**
 * Remove an email from the suppression list.
 */
export async function unsuppressEmail(email: string): Promise<boolean> {
  try {
    await prisma.suppressedEmail.delete({
      where: { email: email.toLowerCase() },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * List suppressed emails with optional filtering.
 */
export async function listSuppressedEmails(options?: {
  reason?: string;
  limit?: number;
  offset?: number;
}) {
  return prisma.suppressedEmail.findMany({
    where: options?.reason ? { reason: options.reason } : undefined,
    take: options?.limit ?? 100,
    skip: options?.offset ?? 0,
    orderBy: { suppressedAt: "desc" },
  });
}
