import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing the service
vi.mock("@/lib/db", () => ({
  prisma: {
    vapiCallLog: {
      deleteMany: vi.fn(),
    },
    smsDeliveryEvent: {
      deleteMany: vi.fn(),
    },
    sequenceStepExecution: {
      deleteMany: vi.fn(),
    },
  },
}));

import { CleanupService } from "@/services/cleanup.service";
import { prisma } from "@/lib/db";

const mockVapiDelete = prisma.vapiCallLog.deleteMany as ReturnType<typeof vi.fn>;
const mockSmsDelete = prisma.smsDeliveryEvent.deleteMany as ReturnType<typeof vi.fn>;
const mockSeqDelete = prisma.sequenceStepExecution.deleteMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CleanupService", () => {
  describe("cleanupVapiCallLogs", () => {
    it("deletes logs older than 30 days by default", async () => {
      mockVapiDelete.mockResolvedValue({ count: 42 });

      const result = await CleanupService.cleanupVapiCallLogs();

      expect(result).toEqual({ deleted: 42 });
      expect(mockVapiDelete).toHaveBeenCalledOnce();
      const where = mockVapiDelete.mock.calls[0][0].where;
      const cutoff = where.createdAt.lt as Date;
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      expect(Math.abs(cutoff.getTime() - thirtyDaysAgo)).toBeLessThan(5000);
    });

    it("respects custom retention days", async () => {
      mockVapiDelete.mockResolvedValue({ count: 10 });

      const result = await CleanupService.cleanupVapiCallLogs(7);

      expect(result).toEqual({ deleted: 10 });
      const where = mockVapiDelete.mock.calls[0][0].where;
      const cutoff = where.createdAt.lt as Date;
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      expect(Math.abs(cutoff.getTime() - sevenDaysAgo)).toBeLessThan(5000);
    });
  });

  describe("cleanupSmsDeliveryEvents", () => {
    it("deletes events older than 90 days by default", async () => {
      mockSmsDelete.mockResolvedValue({ count: 100 });

      const result = await CleanupService.cleanupSmsDeliveryEvents();

      expect(result).toEqual({ deleted: 100 });
      expect(mockSmsDelete).toHaveBeenCalledOnce();
      const where = mockSmsDelete.mock.calls[0][0].where;
      const cutoff = where.receivedAt.lt as Date;
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      expect(Math.abs(cutoff.getTime() - ninetyDaysAgo)).toBeLessThan(5000);
    });
  });

  describe("cleanupOldSequenceExecutions", () => {
    it("only deletes terminal-state executions", async () => {
      mockSeqDelete.mockResolvedValue({ count: 55 });

      const result = await CleanupService.cleanupOldSequenceExecutions();

      expect(result).toEqual({ deleted: 55 });
      expect(mockSeqDelete).toHaveBeenCalledOnce();
      const where = mockSeqDelete.mock.calls[0][0].where;
      expect(where.status.in).toEqual(
        expect.arrayContaining(["COMPLETED", "FAILED", "SKIPPED"])
      );
    });

    it("filters by executedAt date", async () => {
      mockSeqDelete.mockResolvedValue({ count: 0 });

      await CleanupService.cleanupOldSequenceExecutions(60);

      const where = mockSeqDelete.mock.calls[0][0].where;
      const cutoff = where.executedAt.lt as Date;
      const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
      expect(Math.abs(cutoff.getTime() - sixtyDaysAgo)).toBeLessThan(5000);
    });
  });

  describe("runAll", () => {
    it("runs all cleanup jobs and returns aggregate stats", async () => {
      mockVapiDelete.mockResolvedValue({ count: 10 });
      mockSmsDelete.mockResolvedValue({ count: 20 });
      mockSeqDelete.mockResolvedValue({ count: 30 });

      const result = await CleanupService.runAll();

      expect(result).toEqual({
        vapiLogs: 10,
        smsEvents: 20,
        seqExecutions: 30,
      });
      expect(mockVapiDelete).toHaveBeenCalledOnce();
      expect(mockSmsDelete).toHaveBeenCalledOnce();
      expect(mockSeqDelete).toHaveBeenCalledOnce();
    });

    it("returns zeros when nothing to clean", async () => {
      mockVapiDelete.mockResolvedValue({ count: 0 });
      mockSmsDelete.mockResolvedValue({ count: 0 });
      mockSeqDelete.mockResolvedValue({ count: 0 });

      const result = await CleanupService.runAll();

      expect(result).toEqual({
        vapiLogs: 0,
        smsEvents: 0,
        seqExecutions: 0,
      });
    });
  });
});
