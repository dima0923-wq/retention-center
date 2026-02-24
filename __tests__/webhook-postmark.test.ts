import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock PostmarkWebhookService
const mockValidate = vi.fn();
const mockHandleEvent = vi.fn();

vi.mock("@/services/postmark-webhook.service", () => ({
  PostmarkWebhookService: {
    validate: (...args: unknown[]) => mockValidate(...args),
    handleEvent: (...args: unknown[]) => mockHandleEvent(...args),
  },
}));

import { POST } from "@/app/api/webhooks/postmark/route";

function makeRequest(body: unknown): Parameters<typeof POST>[0] {
  return new Request("http://localhost/api/webhooks/postmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0];
}

describe("POST /api/webhooks/postmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls handleEvent and returns received: true for valid payload", async () => {
    mockValidate.mockReturnValueOnce(true);
    mockHandleEvent.mockResolvedValueOnce(undefined);
    const payload = { MessageID: "msg-1", RecordType: "Delivery" };

    const res = await POST(makeRequest(payload));
    const data = await res.json();

    expect(mockValidate).toHaveBeenCalledWith(payload);
    expect(mockHandleEvent).toHaveBeenCalledWith(payload);
    expect(data).toEqual({ received: true });
    expect(res.status).toBe(200);
  });

  it("returns 400 when validation fails (missing MessageID/RecordType)", async () => {
    mockValidate.mockReturnValueOnce(false);
    const payload = { SomeOtherField: "value" };

    const res = await POST(makeRequest(payload));
    const data = await res.json();

    expect(data).toEqual({ error: "Invalid payload: missing MessageID or RecordType" });
    expect(res.status).toBe(400);
    expect(mockHandleEvent).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON payload", async () => {
    const req = new Request("http://localhost/api/webhooks/postmark", {
      method: "POST",
      body: "not-json{{{",
      headers: { "Content-Type": "application/json" },
    }) as Parameters<typeof POST>[0];

    const res = await POST(req);
    const data = await res.json();

    expect(data).toEqual({ error: "Invalid payload" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when handleEvent throws", async () => {
    mockValidate.mockReturnValueOnce(true);
    mockHandleEvent.mockRejectedValueOnce(new Error("DB error"));

    const res = await POST(makeRequest({ MessageID: "msg-2", RecordType: "Open" }));
    expect(res.status).toBe(400);
  });
});
