import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock prisma ----
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockLeadUpdate = vi.fn();
const mockLeadFindUnique = vi.fn();
const mockEnrollmentFindMany = vi.fn();
const mockEnrollmentUpdate = vi.fn();
const mockExecutionUpdateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    contactAttempt: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    lead: {
      update: (...args: unknown[]) => mockLeadUpdate(...args),
      findUnique: (...args: unknown[]) => mockLeadFindUnique(...args),
    },
    sequenceEnrollment: {
      findMany: (...args: unknown[]) => mockEnrollmentFindMany(...args),
      update: (...args: unknown[]) => mockEnrollmentUpdate(...args),
    },
    sequenceStepExecution: {
      updateMany: (...args: unknown[]) => mockExecutionUpdateMany(...args),
    },
  },
}));

vi.mock("@/services/lead-scoring.service", () => ({
  LeadScoringService: {
    calculateScore: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/services/retention-sequence.service", () => ({
  RetentionSequenceService: {
    updateStepExecutionByAttempt: vi.fn().mockResolvedValue(undefined),
  },
}));

import { PostmarkWebhookService } from "@/services/postmark-webhook.service";

describe("PostmarkWebhookService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- validate ----
  describe("validate", () => {
    it("returns true for valid payload with MessageID and RecordType", () => {
      expect(PostmarkWebhookService.validate({
        MessageID: "msg-1",
        RecordType: "Delivery",
      })).toBe(true);
    });

    it("returns false when MessageID is missing", () => {
      expect(PostmarkWebhookService.validate({
        RecordType: "Delivery",
      })).toBe(false);
    });

    it("returns false when RecordType is missing", () => {
      expect(PostmarkWebhookService.validate({
        MessageID: "msg-1",
      })).toBe(false);
    });

    it("returns false for null", () => {
      expect(PostmarkWebhookService.validate(null)).toBe(false);
    });

    it("returns false for non-object", () => {
      expect(PostmarkWebhookService.validate("string")).toBe(false);
    });

    it("returns false for empty MessageID", () => {
      expect(PostmarkWebhookService.validate({
        MessageID: "",
        RecordType: "Delivery",
      })).toBe(false);
    });

    it("returns false for empty RecordType", () => {
      expect(PostmarkWebhookService.validate({
        MessageID: "msg-1",
        RecordType: "",
      })).toBe(false);
    });
  });

  // ---- handleEvent ----
  describe("handleEvent", () => {
    it("does nothing when no matching contact attempt found", async () => {
      mockFindFirst.mockResolvedValueOnce(null);
      await PostmarkWebhookService.handleEvent({
        MessageID: "msg-1",
        RecordType: "Delivery",
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("updates attempt to SUCCESS on Delivery event", async () => {
      mockFindFirst.mockResolvedValueOnce({
        id: "att-1",
        leadId: "lead-1",
        result: null,
      });

      await PostmarkWebhookService.handleEvent({
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

    it("updates attempt to FAILED on Bounce event and adjusts lead score", async () => {
      mockFindFirst.mockResolvedValueOnce({
        id: "att-2",
        leadId: "lead-2",
        result: null,
      });

      await PostmarkWebhookService.handleEvent({
        MessageID: "msg-2",
        RecordType: "Bounce",
        Type: "SoftBounce",
        TypeCode: 50,
        Email: "user@example.com",
        Description: "Mailbox full",
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        })
      );
    });

    it("suppresses lead on hard bounce", async () => {
      mockFindFirst.mockResolvedValueOnce({
        id: "att-3",
        leadId: "lead-3",
        result: null,
      });
      mockLeadUpdate.mockResolvedValue({});
      mockLeadFindUnique.mockResolvedValueOnce({ notes: "" });
      mockEnrollmentFindMany.mockResolvedValueOnce([]);

      await PostmarkWebhookService.handleEvent({
        MessageID: "msg-3",
        RecordType: "Bounce",
        Type: "HardBounce",
        TypeCode: 1,
        Email: "bad@example.com",
        Description: "Unknown user",
      });

      // Lead should be set to DO_NOT_CONTACT
      expect(mockLeadUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "lead-3" },
          data: expect.objectContaining({ status: "DO_NOT_CONTACT" }),
        })
      );
    });

    it("suppresses lead on SpamComplaint", async () => {
      mockFindFirst.mockResolvedValueOnce({
        id: "att-4",
        leadId: "lead-4",
        result: null,
      });
      mockLeadUpdate.mockResolvedValue({});
      mockLeadFindUnique.mockResolvedValueOnce({ notes: "existing notes" });
      mockEnrollmentFindMany.mockResolvedValueOnce([]);

      await PostmarkWebhookService.handleEvent({
        MessageID: "msg-4",
        RecordType: "SpamComplaint",
        Email: "spam@example.com",
      });

      expect(mockLeadUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "lead-4" },
          data: expect.objectContaining({ status: "DO_NOT_CONTACT" }),
        })
      );
    });

    it("skips duplicate events via idempotency check", async () => {
      mockFindFirst.mockResolvedValueOnce({
        id: "att-5",
        leadId: "lead-5",
        result: JSON.stringify({ _processedEvents: ["Delivery"] }),
      });

      await PostmarkWebhookService.handleEvent({
        MessageID: "msg-5",
        RecordType: "Delivery",
      });

      // Should NOT update because Delivery was already processed
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("processes new event type even if other events already processed", async () => {
      mockFindFirst.mockResolvedValueOnce({
        id: "att-6",
        leadId: "lead-6",
        result: JSON.stringify({ _processedEvents: ["Delivery"] }),
      });

      await PostmarkWebhookService.handleEvent({
        MessageID: "msg-6",
        RecordType: "Open",
      });

      // Should update because Open was NOT yet processed
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
