import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock prisma ----
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockFindUnique = vi.fn();
const mockGroupBy = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    smsDeliveryEvent: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
    },
    contactAttempt: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { SmsDeliveryLogService } from "@/services/sms-delivery-log.service";

describe("SmsDeliveryLogService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- listEvents ----
  describe("listEvents", () => {
    it("returns paginated events with defaults (page 1, limit 50)", async () => {
      const mockEvents = [
        {
          id: "evt-1",
          contactAttemptId: "att-1",
          providerRef: "123",
          provider: "sms-retail",
          status: "DELIVERED",
          rawStatus: "delivered",
          rawPayload: "{}",
          senderIp: "1.2.3.4",
          receivedAt: new Date("2026-02-25T10:00:00Z"),
          contactAttempt: {
            lead: { id: "lead-1", firstName: "John", lastName: "Doe", phone: "+1234567890" },
          },
        },
      ];
      mockFindMany.mockResolvedValueOnce(mockEvents);
      mockCount.mockResolvedValueOnce(1);

      const result = await SmsDeliveryLogService.listEvents({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          id: "evt-1",
          provider: "sms-retail",
          status: "DELIVERED",
          rawStatus: "delivered",
          ip: "1.2.3.4",
          lead: { id: "lead-1", firstName: "John", lastName: "Doe", phone: "+1234567890" },
        })
      );
      expect(result.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
      });
    });

    it("applies status filter", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      mockCount.mockResolvedValueOnce(0);

      await SmsDeliveryLogService.listEvents({ status: "FAILED" });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "FAILED" }),
        })
      );
    });

    it("applies provider filter", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      mockCount.mockResolvedValueOnce(0);

      await SmsDeliveryLogService.listEvents({ provider: "23telecom" });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ provider: "23telecom" }),
        })
      );
    });

    it("applies date range filter", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      mockCount.mockResolvedValueOnce(0);

      await SmsDeliveryLogService.listEvents({
        from: "2026-02-01T00:00:00Z",
        to: "2026-02-28T23:59:59Z",
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            receivedAt: {
              gte: new Date("2026-02-01T00:00:00Z"),
              lte: new Date("2026-02-28T23:59:59Z"),
            },
          }),
        })
      );
    });

    it("handles pagination correctly (page 2, limit 10)", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      mockCount.mockResolvedValueOnce(25);

      const result = await SmsDeliveryLogService.listEvents({
        page: 2,
        limit: 10,
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it("clamps limit to max 100", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      mockCount.mockResolvedValueOnce(0);

      await SmsDeliveryLogService.listEvents({ limit: 500 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    it("clamps page to minimum 1", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      mockCount.mockResolvedValueOnce(0);

      await SmsDeliveryLogService.listEvents({ page: -1 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 })
      );
    });
  });

  // ---- getEventsForAttempt ----
  describe("getEventsForAttempt", () => {
    it("returns events for a specific attempt", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "att-1",
        leadId: "lead-1",
        channel: "SMS",
        status: "SUCCESS",
        provider: "sms-retail",
        providerRef: "123",
        startedAt: new Date("2026-02-25T09:00:00Z"),
        completedAt: new Date("2026-02-25T09:01:00Z"),
        lead: { id: "lead-1", firstName: "John", lastName: "Doe", phone: "+1234567890" },
        deliveryEvents: [
          {
            id: "evt-1",
            status: "SENT",
            rawStatus: "sent",
            rawPayload: "{}",
            receivedAt: new Date("2026-02-25T09:00:30Z"),
            senderIp: "1.2.3.4",
          },
          {
            id: "evt-2",
            status: "DELIVERED",
            rawStatus: "delivered",
            rawPayload: "{}",
            receivedAt: new Date("2026-02-25T09:01:00Z"),
            senderIp: "1.2.3.4",
          },
        ],
      });

      const result = await SmsDeliveryLogService.getEventsForAttempt("att-1");

      expect(result).not.toBeNull();
      expect(result!.attempt.id).toBe("att-1");
      expect(result!.attempt.status).toBe("SUCCESS");
      expect(result!.attempt.lead).toEqual(
        expect.objectContaining({ firstName: "John" })
      );
      expect(result!.events).toHaveLength(2);
      expect(result!.events[0].status).toBe("SENT");
      expect(result!.events[1].status).toBe("DELIVERED");
    });

    it("returns null when attempt not found", async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      const result =
        await SmsDeliveryLogService.getEventsForAttempt("nonexistent");

      expect(result).toBeNull();
    });
  });
});
