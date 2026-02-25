import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Mock postmark SDK ----
const mockSendEmailBatch = vi.fn();

vi.mock("postmark", () => {
  class MockServerClient {
    sendEmail = vi.fn();
    sendEmailBatch = mockSendEmailBatch;
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

// ---- Mock prisma ----
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    integrationConfig: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    contactAttempt: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import { EmailBatcherService } from "@/services/channel/email-batcher.service";
import { PostmarkService } from "@/services/channel/postmark.service";
import type { Lead } from "@/generated/prisma/client";

function fakeLead(overrides: Record<string, unknown> = {}): Lead {
  return {
    id: "lead-1",
    externalId: null,
    firstName: "Jane",
    lastName: "Smith",
    phone: "+1234567890",
    email: "jane@example.com",
    source: "web",
    status: "NEW",
    meta: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Lead;
}

function activeConfig() {
  return {
    id: "cfg-1",
    provider: "postmark",
    isActive: true,
    config: JSON.stringify({
      serverToken: "test-token",
      fromEmail: "sender@example.com",
      fromName: "Test Sender",
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("EmailBatcherService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    EmailBatcherService.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    EmailBatcherService.reset();
  });

  it("adds items to queue", () => {
    EmailBatcherService.addToQueue("att-1", fakeLead(), {
      subject: "Hi",
      htmlBody: "<p>Hello</p>",
    });
    expect(EmailBatcherService.queueLength).toBe(1);
  });

  it("flush sends nothing when queue is empty", async () => {
    const results = await EmailBatcherService.flush();
    expect(results).toEqual([]);
  });

  it("flush sends emails via PostmarkService.batchSendFromQueue and updates DB", async () => {
    mockFindUnique.mockResolvedValue(activeConfig());
    mockSendEmailBatch.mockResolvedValueOnce([
      { ErrorCode: 0, MessageID: "msg-1" },
    ]);
    mockUpdate.mockResolvedValue({});

    EmailBatcherService.addToQueue("att-1", fakeLead(), {
      subject: "Hi {{firstName}}",
      htmlBody: "<p>Hello</p>",
      tag: "camp-1",
    });

    const results = await EmailBatcherService.flush();

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      attemptId: "att-1",
      success: true,
      providerRef: "msg-1",
    });

    // Should update ContactAttempt with providerRef
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "att-1" },
        data: expect.objectContaining({
          providerRef: "msg-1",
          status: "IN_PROGRESS",
          provider: "postmark",
        }),
      })
    );
  });

  it("flush handles errors and marks attempts as FAILED", async () => {
    mockFindUnique.mockResolvedValue(activeConfig());
    mockSendEmailBatch.mockResolvedValueOnce([
      { ErrorCode: 406, Message: "Inactive recipient" },
    ]);
    mockUpdate.mockResolvedValue({});

    EmailBatcherService.addToQueue("att-2", fakeLead(), {
      subject: "Hi",
      htmlBody: "<p>Hello</p>",
    });

    const results = await EmailBatcherService.flush();

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("406");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "att-2" },
        data: expect.objectContaining({
          status: "FAILED",
          provider: "postmark",
        }),
      })
    );
  });

  it("flush handles lead with no email", async () => {
    mockFindUnique.mockResolvedValue(activeConfig());
    mockUpdate.mockResolvedValue({});

    EmailBatcherService.addToQueue("att-3", fakeLead({ email: null }), {
      subject: "Hi",
      htmlBody: "<p>Hello</p>",
    });

    const results = await EmailBatcherService.flush();

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("no email");
  });

  it("auto-flushes after 5 second timer", async () => {
    mockFindUnique.mockResolvedValue(activeConfig());
    mockSendEmailBatch.mockResolvedValueOnce([
      { ErrorCode: 0, MessageID: "msg-timer" },
    ]);
    mockUpdate.mockResolvedValue({});

    const flushSpy = vi.spyOn(EmailBatcherService, "flush");

    EmailBatcherService.addToQueue("att-4", fakeLead(), {
      subject: "Timer test",
      htmlBody: "<p>Hello</p>",
    });

    expect(EmailBatcherService.queueLength).toBe(1);

    // Advance timer past 5s
    await vi.advanceTimersByTimeAsync(5_100);

    expect(flushSpy).toHaveBeenCalled();
  });

  it("auto-flushes when batch reaches 50 items", async () => {
    mockFindUnique.mockResolvedValue(activeConfig());
    // Mock batch response for 50 items
    const batchResponse = Array.from({ length: 50 }, (_, i) => ({
      ErrorCode: 0,
      MessageID: `msg-${i}`,
    }));
    mockSendEmailBatch.mockResolvedValueOnce(batchResponse);
    mockUpdate.mockResolvedValue({});

    const flushSpy = vi.spyOn(EmailBatcherService, "flush");

    for (let i = 0; i < 50; i++) {
      EmailBatcherService.addToQueue(
        `att-batch-${i}`,
        fakeLead({ id: `lead-${i}`, email: `lead${i}@test.com` }),
        { subject: "Batch", htmlBody: "<p>Hi</p>" }
      );
    }

    // flush is called async via void, give it a tick
    await vi.advanceTimersByTimeAsync(10);

    expect(flushSpy).toHaveBeenCalled();
  });

  it("reset clears queue and timer", () => {
    EmailBatcherService.addToQueue("att-5", fakeLead(), {
      subject: "Hi",
      htmlBody: "<p>Hello</p>",
    });
    expect(EmailBatcherService.queueLength).toBe(1);

    EmailBatcherService.reset();
    expect(EmailBatcherService.queueLength).toBe(0);
  });

  it("handles multiple items in a single flush", async () => {
    mockFindUnique.mockResolvedValue(activeConfig());
    mockSendEmailBatch.mockResolvedValueOnce([
      { ErrorCode: 0, MessageID: "msg-a" },
      { ErrorCode: 0, MessageID: "msg-b" },
      { ErrorCode: 406, Message: "Bounced" },
    ]);
    mockUpdate.mockResolvedValue({});

    EmailBatcherService.addToQueue("att-a", fakeLead({ id: "l1", email: "a@test.com" }), {
      subject: "A", htmlBody: "<p>A</p>",
    });
    EmailBatcherService.addToQueue("att-b", fakeLead({ id: "l2", email: "b@test.com" }), {
      subject: "B", htmlBody: "<p>B</p>",
    });
    EmailBatcherService.addToQueue("att-c", fakeLead({ id: "l3", email: "c@test.com" }), {
      subject: "C", htmlBody: "<p>C</p>",
    });

    const results = await EmailBatcherService.flush();

    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.success)).toHaveLength(2);
    expect(results.filter((r) => !r.success)).toHaveLength(1);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });
});

describe("PostmarkService.batchSendFromQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns errors for all items when config is missing", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const results = await PostmarkService.batchSendFromQueue([
      { lead: fakeLead(), subject: "Hi", htmlBody: "<p>Hi</p>" },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].error).toContain("not configured");
  });

  it("returns error for leads without email", async () => {
    mockFindUnique.mockResolvedValueOnce(activeConfig());
    const results = await PostmarkService.batchSendFromQueue([
      { lead: fakeLead({ email: null }), subject: "Hi", htmlBody: "<p>Hi</p>" },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].error).toContain("no email");
  });

  it("sends in chunks of 50 and returns per-item results", async () => {
    mockFindUnique.mockResolvedValueOnce(activeConfig());

    // 3 items, all succeed
    mockSendEmailBatch.mockResolvedValueOnce([
      { ErrorCode: 0, MessageID: "m1" },
      { ErrorCode: 0, MessageID: "m2" },
      { ErrorCode: 0, MessageID: "m3" },
    ]);

    const items = [
      { lead: fakeLead({ id: "l1", email: "a@t.com" }), subject: "A", htmlBody: "<p>A</p>" },
      { lead: fakeLead({ id: "l2", email: "b@t.com" }), subject: "B", htmlBody: "<p>B</p>" },
      { lead: fakeLead({ id: "l3", email: "c@t.com" }), subject: "C", htmlBody: "<p>C</p>" },
    ];

    const results = await PostmarkService.batchSendFromQueue(items);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ index: 0, providerRef: "m1" });
    expect(results[1]).toEqual({ index: 1, providerRef: "m2" });
    expect(results[2]).toEqual({ index: 2, providerRef: "m3" });
  });

  it("handles batch API failure gracefully", async () => {
    mockFindUnique.mockResolvedValueOnce(activeConfig());
    mockSendEmailBatch.mockRejectedValueOnce(new Error("Network error"));

    const results = await PostmarkService.batchSendFromQueue([
      { lead: fakeLead(), subject: "Hi", htmlBody: "<p>Hi</p>" },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].error).toContain("Network error");
  });
});
