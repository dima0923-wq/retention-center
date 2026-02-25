import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock prisma ----
const mockContactAttemptFindFirst = vi.fn();
const mockContactAttemptUpdate = vi.fn();
const mockSmsDeliveryEventCreate = vi.fn();
const mockIntegrationConfigFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    contactAttempt: {
      findFirst: (...args: unknown[]) => mockContactAttemptFindFirst(...args),
      update: (...args: unknown[]) => mockContactAttemptUpdate(...args),
    },
    smsDeliveryEvent: {
      create: (...args: unknown[]) => mockSmsDeliveryEventCreate(...args),
    },
    integrationConfig: {
      findFirst: (...args: unknown[]) => mockIntegrationConfigFindFirst(...args),
    },
  },
}));

// Mock SmsService.handleCallback
const mockHandleCallback = vi.fn();
vi.mock("@/services/channel/sms.service", () => ({
  SmsService: {
    handleCallback: (...args: unknown[]) => mockHandleCallback(...args),
  },
}));

import { POST } from "@/app/api/webhooks/sms/route";
import { NextRequest } from "next/server";

function makeRequest(
  body: unknown,
  headers?: Record<string, string>
): NextRequest {
  const req = new NextRequest("http://localhost/api/webhooks/sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "1.2.3.4",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return req;
}

function makeRawRequest(rawBody: string): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
}

describe("POST /api/webhooks/sms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSmsDeliveryEventCreate.mockResolvedValue({ id: "evt-1" });
    mockIntegrationConfigFindFirst.mockResolvedValue(null);
  });

  // --- sms-retail payloads ---
  describe("sms-retail provider", () => {
    it("creates SmsDeliveryEvent and updates ContactAttempt for delivered status", async () => {
      mockContactAttemptFindFirst.mockResolvedValueOnce({
        id: "att-1",
        leadId: "lead-1",
        providerRef: "123",
      });
      mockHandleCallback.mockResolvedValueOnce(undefined);

      const res = await POST(makeRequest({ id: 123, status: "delivered" }));
      const data = await res.json();

      expect(data).toEqual({ success: true });
      expect(res.status).toBe(200);

      // SmsDeliveryEvent created with correct fields
      expect(mockSmsDeliveryEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactAttemptId: "att-1",
          providerRef: "123",
          provider: "sms-retail",
          status: "DELIVERED",
          rawStatus: "delivered",
          rawPayload: JSON.stringify({ id: 123, status: "delivered" }),
          senderIp: "1.2.3.4",
        }),
      });

      // SmsService.handleCallback called
      expect(mockHandleCallback).toHaveBeenCalledWith({
        id: 123,
        status: "delivered",
      });
    });

    it("creates SmsDeliveryEvent even when no matching ContactAttempt", async () => {
      mockContactAttemptFindFirst.mockResolvedValueOnce(null);

      const res = await POST(makeRequest({ id: 456, status: "failed" }));
      const data = await res.json();

      expect(data).toEqual({ success: true });
      expect(mockSmsDeliveryEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactAttemptId: null,
          providerRef: "456",
          provider: "sms-retail",
          status: "FAILED",
          rawStatus: "failed",
        }),
      });
      // handleCallback NOT called when no attempt
      expect(mockHandleCallback).not.toHaveBeenCalled();
    });
  });

  // --- 23telecom payloads ---
  describe("23telecom provider", () => {
    it("creates SmsDeliveryEvent for DELIVRD status", async () => {
      mockContactAttemptFindFirst.mockResolvedValueOnce({
        id: "att-2",
        leadId: "lead-2",
        providerRef: "abc-123",
      });
      mockHandleCallback.mockResolvedValueOnce(undefined);

      const res = await POST(
        makeRequest({ messageId: "abc-123", status: "DELIVRD" })
      );
      const data = await res.json();

      expect(data).toEqual({ success: true });
      expect(mockSmsDeliveryEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactAttemptId: "att-2",
          providerRef: "abc-123",
          provider: "23telecom",
          status: "DELIVERED",
          rawStatus: "DELIVRD",
        }),
      });
      expect(mockHandleCallback).toHaveBeenCalledWith({
        messageId: "abc-123",
        status: "DELIVRD",
      });
    });

    it("maps UNDELIV to FAILED status", async () => {
      mockContactAttemptFindFirst.mockResolvedValueOnce(null);

      await POST(
        makeRequest({ messageId: "xyz", status: "UNDELIV" })
      );

      expect(mockSmsDeliveryEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "FAILED",
          rawStatus: "UNDELIV",
          provider: "23telecom",
        }),
      });
    });
  });

  // --- Unknown/invalid payloads ---
  describe("invalid payloads", () => {
    it("returns 200 for unknown payload shape (no id or messageId)", async () => {
      const res = await POST(
        makeRequest({ unknownField: "value", anotherField: 42 })
      );
      const data = await res.json();

      expect(data).toEqual({ success: true });
      expect(res.status).toBe(200);
      // No SmsDeliveryEvent should be created for unrecognized payloads
      expect(mockSmsDeliveryEventCreate).not.toHaveBeenCalled();
    });

    it("returns 200 for empty body", async () => {
      const res = await POST(makeRequest({}));
      const data = await res.json();

      expect(data).toEqual({ success: true });
      expect(res.status).toBe(200);
    });

    it("returns 200 for invalid JSON", async () => {
      const res = await POST(makeRawRequest("not-json{{{"));
      const data = await res.json();

      expect(data).toEqual({ success: true });
      expect(res.status).toBe(200);
    });

    it("returns 200 when DB error occurs (never fail)", async () => {
      mockContactAttemptFindFirst.mockRejectedValueOnce(
        new Error("DB connection failed")
      );

      const res = await POST(makeRequest({ id: 999, status: "delivered" }));
      const data = await res.json();

      expect(data).toEqual({ success: true });
      expect(res.status).toBe(200);
    });
  });

  // --- SmsDeliveryEvent field verification ---
  describe("SmsDeliveryEvent fields", () => {
    it("stores rawPayload as JSON string", async () => {
      mockContactAttemptFindFirst.mockResolvedValueOnce(null);

      const payload = { id: 100, status: "sent", extra: { nested: true } };
      await POST(makeRequest(payload));

      expect(mockSmsDeliveryEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          rawPayload: JSON.stringify(payload),
        }),
      });
    });

    it("extracts senderIp from x-forwarded-for header", async () => {
      mockContactAttemptFindFirst.mockResolvedValueOnce(null);

      await POST(
        makeRequest({ id: 1, status: "delivered" }, { "x-forwarded-for": "10.0.0.1, 10.0.0.2" })
      );

      expect(mockSmsDeliveryEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          senderIp: "10.0.0.1",
        }),
      });
    });

    it("maps unknown rawStatus to UNKNOWN normalized status", async () => {
      mockContactAttemptFindFirst.mockResolvedValueOnce(null);

      await POST(makeRequest({ id: 1, status: "some_weird_status" }));

      expect(mockSmsDeliveryEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "UNKNOWN",
          rawStatus: "some_weird_status",
        }),
      });
    });
  });
});
