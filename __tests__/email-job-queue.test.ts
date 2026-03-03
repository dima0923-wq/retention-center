import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock prisma ----
const mockEmailJobCreate = vi.fn();
const mockEmailJobFindMany = vi.fn();
const mockEmailJobUpdateMany = vi.fn();
const mockEmailJobUpdate = vi.fn();
const mockLeadFindUnique = vi.fn();
const mockContactAttemptUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    emailJob: {
      create: (...args: unknown[]) => mockEmailJobCreate(...args),
      findMany: (...args: unknown[]) => mockEmailJobFindMany(...args),
      updateMany: (...args: unknown[]) => mockEmailJobUpdateMany(...args),
      update: (...args: unknown[]) => mockEmailJobUpdate(...args),
    },
    lead: {
      findUnique: (...args: unknown[]) => mockLeadFindUnique(...args),
    },
    contactAttempt: {
      update: (...args: unknown[]) => mockContactAttemptUpdate(...args),
    },
    integrationConfig: {
      findUnique: vi.fn().mockResolvedValue({
        id: "cfg-1",
        provider: "postmark",
        isActive: true,
        config: JSON.stringify({
          serverToken: "test-token",
          fromEmail: "sender@example.com",
          fromName: "Test Sender",
        }),
      }),
    },
    suppressedEmail: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

// Mock suppression
vi.mock("@/lib/suppression", () => ({
  isEmailSuppressed: vi.fn().mockResolvedValue(false),
}));

// Mock postmark
vi.mock("postmark", () => {
  class MockServerClient {
    sendEmail = vi.fn();
    sendEmailBatch = vi.fn().mockResolvedValue([
      { ErrorCode: 0, MessageID: "msg-123" },
    ]);
    getServer = vi.fn();
    sendEmailWithTemplate = vi.fn();
  }
  class MockAccountClient {}
  return {
    ServerClient: MockServerClient,
    AccountClient: MockAccountClient,
    Models: {
      LinkTrackingOptions: { HtmlAndText: "HtmlAndText" },
    },
  };
});

import { enqueueEmailJob, processEmailJobs } from "@/lib/email-job-queue";

describe("Email Job Queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enqueueEmailJob", () => {
    it("creates a job in the database", async () => {
      mockEmailJobCreate.mockResolvedValueOnce({ id: "job-1" });

      const jobId = await enqueueEmailJob({
        attemptId: "att-1",
        leadId: "lead-1",
        subject: "Test",
        htmlBody: "<p>Hello</p>",
      });

      expect(jobId).toBe("job-1");
      expect(mockEmailJobCreate).toHaveBeenCalledWith({
        data: {
          payload: expect.stringContaining('"attemptId":"att-1"'),
          status: "pending",
        },
      });
    });
  });

  describe("processEmailJobs", () => {
    it("returns 0 when no pending jobs", async () => {
      mockEmailJobFindMany.mockResolvedValueOnce([]);
      const count = await processEmailJobs();
      expect(count).toBe(0);
    });

    it("processes pending jobs and marks them completed", async () => {
      const payload = JSON.stringify({
        attemptId: "att-1",
        leadId: "lead-1",
        subject: "Test",
        htmlBody: "<p>Hello</p>",
      });

      mockEmailJobFindMany.mockResolvedValueOnce([
        { id: "job-1", payload, status: "pending", attempts: 0, maxAttempts: 3 },
      ]);
      mockEmailJobUpdateMany.mockResolvedValue({ count: 1 });
      mockLeadFindUnique.mockResolvedValueOnce({
        id: "lead-1",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        phone: null,
      });
      mockEmailJobUpdate.mockResolvedValue({});
      mockContactAttemptUpdate.mockResolvedValue({});

      const count = await processEmailJobs();

      expect(count).toBe(1);
      // Should mark job as completed
      expect(mockEmailJobUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job-1" },
          data: expect.objectContaining({ status: "completed" }),
        })
      );
    });

    it("marks job as failed when lead not found", async () => {
      const payload = JSON.stringify({
        attemptId: "att-2",
        leadId: "missing-lead",
        subject: "Test",
        htmlBody: "<p>Hello</p>",
      });

      mockEmailJobFindMany.mockResolvedValueOnce([
        { id: "job-2", payload, status: "pending", attempts: 0, maxAttempts: 3 },
      ]);
      mockEmailJobUpdateMany.mockResolvedValue({ count: 1 });
      mockLeadFindUnique.mockResolvedValueOnce(null);
      mockEmailJobUpdate.mockResolvedValue({});

      const count = await processEmailJobs();

      expect(count).toBe(0); // No items processed via batch
      expect(mockEmailJobUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job-2" },
          data: expect.objectContaining({ status: "failed", error: "Lead not found" }),
        })
      );
    });
  });
});
