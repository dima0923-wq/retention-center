import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock postmark SDK ----
const mockSendEmail = vi.fn();
const mockSendEmailBatch = vi.fn();
const mockGetServer = vi.fn();
const mockSendEmailWithTemplate = vi.fn();

vi.mock("postmark", () => {
  class MockServerClient {
    sendEmail = mockSendEmail;
    sendEmailBatch = mockSendEmailBatch;
    getServer = mockGetServer;
    sendEmailWithTemplate = mockSendEmailWithTemplate;
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
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    integrationConfig: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    contactAttempt: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import { PostmarkService } from "@/services/channel/postmark.service";

// Helper: fake Lead
function fakeLead(overrides: Record<string, unknown> = {}) {
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
  } as Parameters<typeof PostmarkService.sendEmail>[0];
}

function activeConfig(extra: Record<string, unknown> = {}) {
  return {
    id: "cfg-1",
    provider: "postmark",
    isActive: true,
    config: JSON.stringify({
      serverToken: "test-token",
      fromEmail: "sender@example.com",
      fromName: "Test Sender",
      ...extra,
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("PostmarkService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- sendEmail ----
  describe("sendEmail", () => {
    it("returns error when config is missing", async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      const result = await PostmarkService.sendEmail(fakeLead(), {
        subject: "Hi",
        htmlBody: "<p>Hello</p>",
      });
      expect(result).toEqual({
        error: "Postmark integration not configured or inactive",
      });
    });

    it("returns error when config is inactive", async () => {
      mockFindUnique.mockResolvedValueOnce({ ...activeConfig(), isActive: false });
      const result = await PostmarkService.sendEmail(fakeLead(), {
        subject: "Hi",
        htmlBody: "<p>Hello</p>",
      });
      expect(result).toEqual({
        error: "Postmark integration not configured or inactive",
      });
    });

    it("returns error when lead has no email", async () => {
      mockFindUnique.mockResolvedValueOnce(activeConfig());
      const lead = fakeLead({ email: null });
      const result = await PostmarkService.sendEmail(lead, {
        subject: "Hi",
        htmlBody: "<p>Hello</p>",
      });
      expect(result).toEqual({ error: "Lead has no email address" });
    });

    it("sends email successfully and returns providerRef", async () => {
      mockFindUnique.mockResolvedValueOnce(activeConfig());
      mockSendEmail.mockResolvedValueOnce({ MessageID: "msg-abc-123" });

      const result = await PostmarkService.sendEmail(
        fakeLead(),
        { subject: "Hello {{firstName}}", htmlBody: "<p>Hi {{firstName}} {{lastName}}</p>" },
        { tag: "test", metadata: { campaign: "c1" } }
      );

      expect(result).toEqual({ providerRef: "msg-abc-123" });
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          To: "jane@example.com",
          Subject: "Hello Jane",
          HtmlBody: "<p>Hi Jane Smith</p>",
          Tag: "test",
          Metadata: { campaign: "c1" },
          TrackOpens: true,
          MessageStream: "outbound",
        })
      );
    });

    it("replaces template variables in textBody", async () => {
      mockFindUnique.mockResolvedValueOnce(activeConfig());
      mockSendEmail.mockResolvedValueOnce({ MessageID: "msg-456" });

      await PostmarkService.sendEmail(fakeLead(), {
        subject: "Hi",
        htmlBody: "<p>Hello</p>",
        textBody: "Hello {{firstName}}, your phone is {{phone}}",
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          TextBody: "Hello Jane, your phone is +1234567890",
        })
      );
    });

    it("uses template fromEmail/fromName over config defaults", async () => {
      mockFindUnique.mockResolvedValueOnce(activeConfig());
      mockSendEmail.mockResolvedValueOnce({ MessageID: "msg-789" });

      await PostmarkService.sendEmail(fakeLead(), {
        subject: "Test",
        htmlBody: "<p>Test</p>",
        fromEmail: "custom@example.com",
        fromName: "Custom Sender",
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          From: "Custom Sender <custom@example.com>",
        })
      );
    });

    it("catches postmark API errors and returns error", async () => {
      mockFindUnique.mockResolvedValueOnce(activeConfig());
      mockSendEmail.mockRejectedValueOnce(new Error("Invalid token"));

      const result = await PostmarkService.sendEmail(fakeLead(), {
        subject: "Test",
        htmlBody: "<p>Test</p>",
      });

      expect(result).toEqual({ error: "Postmark error: Invalid token" });
    });
  });

  // ---- sendBatchEmail ----
  describe("sendBatchEmail", () => {
    it("returns zeros when config is missing", async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      const result = await PostmarkService.sendBatchEmail(
        [fakeLead(), fakeLead()],
        { subject: "Hi", htmlBody: "<p>Hi</p>" }
      );
      expect(result).toEqual({ sent: 0, errors: 2 });
    });

    it("counts leads without email as errors", async () => {
      mockFindUnique.mockResolvedValueOnce(activeConfig());
      mockSendEmailBatch.mockResolvedValueOnce([{ ErrorCode: 0 }]);

      const leads = [fakeLead(), fakeLead({ email: null })];
      const result = await PostmarkService.sendBatchEmail(leads, {
        subject: "Hi",
        htmlBody: "<p>Hi</p>",
      });
      // 1 sent (has email), 1 error (no email)
      expect(result).toEqual({ sent: 1, errors: 1 });
    });

    it("returns all errors when no leads have email", async () => {
      mockFindUnique.mockResolvedValueOnce(activeConfig());
      const leads = [fakeLead({ email: null }), fakeLead({ email: null })];
      const result = await PostmarkService.sendBatchEmail(leads, {
        subject: "Hi",
        htmlBody: "<p>Hi</p>",
      });
      expect(result).toEqual({ sent: 0, errors: 2 });
      expect(mockSendEmailBatch).not.toHaveBeenCalled();
    });

    it("counts individual message errors from batch results", async () => {
      mockFindUnique.mockResolvedValueOnce(activeConfig());
      mockSendEmailBatch.mockResolvedValueOnce([
        { ErrorCode: 0 },
        { ErrorCode: 406 },
        { ErrorCode: 0 },
      ]);

      const leads = [fakeLead(), fakeLead({ id: "l2" }), fakeLead({ id: "l3" })];
      const result = await PostmarkService.sendBatchEmail(leads, {
        subject: "Hi",
        htmlBody: "<p>Hi</p>",
      });
      expect(result).toEqual({ sent: 2, errors: 1 });
    });

    it("handles batch API failure gracefully", async () => {
      mockFindUnique.mockResolvedValueOnce(activeConfig());
      mockSendEmailBatch.mockRejectedValueOnce(new Error("Batch failed"));

      const leads = [fakeLead(), fakeLead({ id: "l2" })];
      const result = await PostmarkService.sendBatchEmail(leads, {
        subject: "Hi",
        htmlBody: "<p>Hi</p>",
      });
      expect(result).toEqual({ sent: 0, errors: 2 });
    });
  });

  // ---- testConnection ----
  describe("testConnection", () => {
    it("returns not configured when no config", async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      const result = await PostmarkService.testConnection();
      expect(result).toEqual({ ok: false, error: "Not configured" });
    });

    it("returns ok when getServer succeeds", async () => {
      mockFindUnique.mockResolvedValueOnce(activeConfig());
      mockGetServer.mockResolvedValueOnce({ Name: "My Server" });
      const result = await PostmarkService.testConnection();
      expect(result).toEqual({ ok: true });
    });

    it("returns error when getServer throws", async () => {
      mockFindUnique.mockResolvedValueOnce(activeConfig());
      mockGetServer.mockRejectedValueOnce(new Error("Unauthorized"));
      const result = await PostmarkService.testConnection();
      expect(result).toEqual({ ok: false, error: "Unauthorized" });
    });
  });

  // ---- handleWebhookEvent ----
  describe("handleWebhookEvent", () => {
    it("does nothing when MessageID is missing", async () => {
      await PostmarkService.handleWebhookEvent({ RecordType: "Delivery" });
      expect(mockFindFirst).not.toHaveBeenCalled();
    });

    it("does nothing when no matching attempt found", async () => {
      mockFindFirst.mockResolvedValueOnce(null);
      await PostmarkService.handleWebhookEvent({
        MessageID: "msg-1",
        RecordType: "Delivery",
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("updates attempt to SUCCESS on Delivery event", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "att-1" });
      await PostmarkService.handleWebhookEvent({
        MessageID: "msg-1",
        RecordType: "Delivery",
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "att-1" },
          data: expect.objectContaining({ status: "SUCCESS" }),
        })
      );
    });

    it("updates attempt to FAILED on Bounce event", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "att-2" });
      await PostmarkService.handleWebhookEvent({
        MessageID: "msg-2",
        RecordType: "Bounce",
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "att-2" },
          data: expect.objectContaining({ status: "FAILED" }),
        })
      );
    });

    it("updates attempt to FAILED on SpamComplaint", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "att-3" });
      await PostmarkService.handleWebhookEvent({
        MessageID: "msg-3",
        RecordType: "SpamComplaint",
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        })
      );
    });

    it("updates attempt to SUCCESS on Open event", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "att-4" });
      await PostmarkService.handleWebhookEvent({
        MessageID: "msg-4",
        RecordType: "Open",
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "SUCCESS" }),
        })
      );
    });

    it("updates attempt to SUCCESS on Click event", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "att-5" });
      await PostmarkService.handleWebhookEvent({
        MessageID: "msg-5",
        RecordType: "Click",
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "SUCCESS" }),
        })
      );
    });

    it("defaults to IN_PROGRESS for unknown RecordType", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "att-6" });
      await PostmarkService.handleWebhookEvent({
        MessageID: "msg-6",
        RecordType: "Subscription",
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "IN_PROGRESS" }),
        })
      );
    });

    it("stores full webhook payload as result JSON", async () => {
      const payload = { MessageID: "msg-7", RecordType: "Delivery", Tag: "campaign-1" };
      mockFindFirst.mockResolvedValueOnce({ id: "att-7" });
      await PostmarkService.handleWebhookEvent(payload);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ result: JSON.stringify(payload) }),
        })
      );
    });
  });
});
