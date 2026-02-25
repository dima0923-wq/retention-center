import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock WebhookService ----
const mockGetBySlug = vi.fn();
const mockProcessInbound = vi.fn();

vi.mock("@/services/webhook.service", () => ({
  WebhookService: {
    getBySlug: (...args: unknown[]) => mockGetBySlug(...args),
    processInbound: (...args: unknown[]) => mockProcessInbound(...args),
  },
}));

import { GET, POST } from "@/app/api/webhooks/inbound/[slug]/route";
import { NextRequest } from "next/server";

// ---- Helpers ----
function makeContext(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function makeGetRequest(slug: string, query: Record<string, string> = {}) {
  const params = new URLSearchParams(query);
  const url = `http://localhost/api/webhooks/inbound/${slug}${params.toString() ? "?" + params.toString() : ""}`;
  return new NextRequest(url, { method: "GET" });
}

function makePostRequest(slug: string, body: unknown) {
  return new NextRequest(`http://localhost/api/webhooks/inbound/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeWebhook(overrides: Record<string, unknown> = {}) {
  return {
    id: "wh-1",
    name: "Test Webhook",
    slug: "abc12345",
    type: "generic",
    sourceLabel: "TEST",
    isActive: true,
    verifyToken: "my-verify",
    pageAccessToken: null,
    config: null,
    fieldMapping: null,
    campaign: null,
    sequence: null,
    ...overrides,
  };
}

describe("Inbound Webhook Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── GET /api/webhooks/inbound/[slug] (Facebook Verification) ─────────────

  describe("GET /api/webhooks/inbound/[slug]", () => {
    it("returns challenge as plain text for valid Facebook verification", async () => {
      mockProcessInbound.mockResolvedValueOnce({ challenge: "challenge_abc123" });

      const res = await GET(
        makeGetRequest("abc12345", {
          "hub.mode": "subscribe",
          "hub.verify_token": "my-verify",
          "hub.challenge": "challenge_abc123",
        }),
        makeContext("abc12345")
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("challenge_abc123");
      expect(mockProcessInbound).toHaveBeenCalledWith(
        "abc12345",
        "GET",
        {},
        expect.objectContaining({
          "hub.mode": "subscribe",
          "hub.verify_token": "my-verify",
          "hub.challenge": "challenge_abc123",
        })
      );
    });

    it("returns error when processInbound returns error (404)", async () => {
      mockProcessInbound.mockResolvedValueOnce({ error: "Webhook not found", status: 404 });

      const res = await GET(
        makeGetRequest("nosuchslug", {
          "hub.mode": "subscribe",
          "hub.verify_token": "t",
          "hub.challenge": "c",
        }),
        makeContext("nosuchslug")
      );

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Webhook not found");
    });

    it("returns 403 when processInbound rejects verification", async () => {
      mockProcessInbound.mockResolvedValueOnce({ error: "Verification failed", status: 403 });

      const res = await GET(
        makeGetRequest("abc12345", {
          "hub.mode": "subscribe",
          "hub.verify_token": "wrong",
          "hub.challenge": "c",
        }),
        makeContext("abc12345")
      );

      expect(res.status).toBe(403);
    });

    it("returns 403 for inactive webhook", async () => {
      mockProcessInbound.mockResolvedValueOnce({ error: "Webhook is inactive", status: 403 });

      const res = await GET(
        makeGetRequest("abc12345", {
          "hub.mode": "subscribe",
          "hub.verify_token": "my-verify",
          "hub.challenge": "c",
        }),
        makeContext("abc12345")
      );

      expect(res.status).toBe(403);
    });

    it("returns 500 when processInbound throws", async () => {
      mockProcessInbound.mockRejectedValueOnce(new Error("Unexpected error"));

      const res = await GET(
        makeGetRequest("abc12345", {
          "hub.mode": "subscribe",
          "hub.verify_token": "t",
          "hub.challenge": "c",
        }),
        makeContext("abc12345")
      );

      expect(res.status).toBe(500);
    });
  });

  // ─── POST /api/webhooks/inbound/[slug] ────────────────────────────────────

  describe("POST /api/webhooks/inbound/[slug]", () => {
    it("processes Zapier payload and returns success", async () => {
      mockProcessInbound.mockResolvedValueOnce({
        success: true,
        leadId: "lead-1",
        deduplicated: false,
      });
      mockGetBySlug.mockResolvedValueOnce(fakeWebhook({ type: "zapier" }));

      const res = await POST(
        makePostRequest("abc12345", {
          email: "zapier@example.com",
          first_name: "Test",
          last_name: "User",
        }),
        makeContext("abc12345")
      );

      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.leadId).toBe("lead-1");
    });

    it("calls processInbound with slug, POST, body, and query", async () => {
      mockProcessInbound.mockResolvedValueOnce({
        success: true,
        leadId: "l1",
        deduplicated: false,
      });
      mockGetBySlug.mockResolvedValueOnce(fakeWebhook());

      const req = new NextRequest(
        "http://localhost/api/webhooks/inbound/abc12345?source=test&ref=123",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "a@b.com" }),
        }
      );

      await POST(req, makeContext("abc12345"));

      expect(mockProcessInbound).toHaveBeenCalledWith(
        "abc12345",
        "POST",
        { email: "a@b.com" },
        expect.objectContaining({ source: "test", ref: "123" })
      );
    });

    it("returns error for non-facebook webhook when processInbound errors", async () => {
      mockProcessInbound.mockResolvedValueOnce({ error: "Webhook not found", status: 404 });
      mockGetBySlug.mockResolvedValueOnce(null);

      const res = await POST(
        makePostRequest("badslug", { email: "a@b.com" }),
        makeContext("badslug")
      );

      expect(res.status).toBe(404);
    });

    it("returns 403 for inactive webhook", async () => {
      mockProcessInbound.mockResolvedValueOnce({ error: "Webhook is inactive", status: 403 });
      mockGetBySlug.mockResolvedValueOnce(fakeWebhook({ isActive: false }));

      const res = await POST(
        makePostRequest("abc12345", { email: "a@b.com" }),
        makeContext("abc12345")
      );

      // Non-facebook returns the error status
      expect(res.status).toBe(403);
    });

    it("returns received:true for Facebook webhook even on error", async () => {
      mockProcessInbound.mockResolvedValueOnce({ error: "No email or phone found", status: 400 });
      mockGetBySlug.mockResolvedValueOnce(fakeWebhook({ type: "facebook" }));

      const res = await POST(
        makePostRequest("abc12345", { entry: [] }),
        makeContext("abc12345")
      );

      const data = await res.json();
      expect(data.received).toBe(true);
    });

    it("returns received:true for Facebook webhook on success", async () => {
      mockProcessInbound.mockResolvedValueOnce({
        success: true,
        leadId: "lead-fb",
        deduplicated: false,
      });
      mockGetBySlug.mockResolvedValueOnce(fakeWebhook({ type: "facebook" }));

      const res = await POST(
        makePostRequest("abc12345", {
          entry: [{ changes: [{ value: { field_data: [{ name: "email", values: ["fb@x.com"] }] } }] }],
        }),
        makeContext("abc12345")
      );

      const data = await res.json();
      expect(data.received).toBe(true);
    });

    it("returns received:true for malformed JSON body", async () => {
      // When JSON parsing fails, route returns {received: true} regardless of webhook type
      const req = new NextRequest("http://localhost/api/webhooks/inbound/abc12345", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-valid-json{{{",
      });

      const res = await POST(req, makeContext("abc12345"));
      const data = await res.json();
      expect(data.received).toBe(true);
    });

    it("returns received:true on uncaught exception (Facebook safety)", async () => {
      mockProcessInbound.mockRejectedValueOnce(new Error("Crash"));

      const res = await POST(
        makePostRequest("abc12345", { email: "a@b.com" }),
        makeContext("abc12345")
      );

      const data = await res.json();
      // Outer catch returns {received: true, error: "Processing error"}
      expect(data.received).toBe(true);
    });

    it("processes generic payload and returns success with lead data", async () => {
      mockProcessInbound.mockResolvedValueOnce({
        success: true,
        leadId: "lead-gen",
        deduplicated: false,
      });
      mockGetBySlug.mockResolvedValueOnce(fakeWebhook({ type: "generic" }));

      const res = await POST(
        makePostRequest("abc12345", {
          email: "custom@example.com",
          nome: "Mario",
        }),
        makeContext("abc12345")
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.leadId).toBe("lead-gen");
    });

    it("processes deduplicated lead correctly", async () => {
      mockProcessInbound.mockResolvedValueOnce({
        success: true,
        leadId: "lead-existing",
        deduplicated: true,
      });
      mockGetBySlug.mockResolvedValueOnce(fakeWebhook({ type: "generic" }));

      const res = await POST(
        makePostRequest("abc12345", { email: "existing@example.com" }),
        makeContext("abc12345")
      );
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.deduplicated).toBe(true);
    });

    it("returns 400 for no email/phone error", async () => {
      mockProcessInbound.mockResolvedValueOnce({
        error: "No email or phone found in payload",
        status: 400,
      });
      mockGetBySlug.mockResolvedValueOnce(fakeWebhook({ type: "generic" }));

      const res = await POST(
        makePostRequest("abc12345", { random: "data" }),
        makeContext("abc12345")
      );

      expect(res.status).toBe(400);
    });
  });
});
