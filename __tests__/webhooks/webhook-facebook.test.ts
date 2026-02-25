import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock prisma ----
const mockWebhookFindUnique = vi.fn();
const mockWebhookUpdate = vi.fn();
const mockCampaignLeadFindUnique = vi.fn();
const mockCampaignLeadCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    webhook: {
      findUnique: (...args: unknown[]) => mockWebhookFindUnique(...args),
      update: (...args: unknown[]) => mockWebhookUpdate(...args),
    },
    campaignLead: {
      findUnique: (...args: unknown[]) => mockCampaignLeadFindUnique(...args),
      create: (...args: unknown[]) => mockCampaignLeadCreate(...args),
    },
  },
}));

// ---- Mock LeadService ----
const mockLeadServiceCreate = vi.fn();
vi.mock("@/services/lead.service", () => ({
  LeadService: {
    create: (...args: unknown[]) => mockLeadServiceCreate(...args),
  },
}));

// ---- Mock LeadRouterService ----
const mockRouteNewLead = vi.fn();
vi.mock("@/services/lead-router.service", () => ({
  LeadRouterService: {
    routeNewLead: (...args: unknown[]) => mockRouteNewLead(...args),
  },
}));

// ---- Mock RetentionSequenceService ----
const mockEnrollLead = vi.fn();
vi.mock("@/services/retention-sequence.service", () => ({
  RetentionSequenceService: {
    enrollLead: (...args: unknown[]) => mockEnrollLead(...args),
  },
}));

// ---- Mock global fetch (Graph API) ----
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { WebhookService } from "@/services/webhook.service";

// ---- Helpers ----
function fakeWebhook(overrides: Record<string, unknown> = {}) {
  return {
    id: "wh-fb",
    name: "Facebook Webhook",
    slug: "fbslug01",
    type: "facebook",
    sourceLabel: "FB_MAIN",
    isActive: true,
    verifyToken: "fb-verify-token",
    pageAccessToken: null,
    config: "{}",
    campaignId: null,
    sequenceId: null,
    fieldMapping: null,
    lastReceivedAt: null,
    leadCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeLeadResult(overrides: Record<string, unknown> = {}) {
  return {
    lead: {
      id: "lead-fb-1",
      firstName: "Facebook",
      lastName: "User",
      email: "fb@example.com",
      phone: null,
      ...overrides,
    },
    deduplicated: false,
  };
}

function makeFbPayload(fieldData: Array<{ name: string; values: string[] }>, leadgenId = "lg-123") {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              leadgen_id: leadgenId,
              field_data: fieldData,
            },
          },
        ],
      },
    ],
  };
}

describe("Facebook Webhook (WebhookService)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouteNewLead.mockResolvedValue(undefined);
    mockEnrollLead.mockResolvedValue(undefined);
  });

  // ─── Facebook Verification Handshake ──────────────────────────────────────

  describe("Facebook verification handshake", () => {
    it("returns challenge when mode=subscribe and token matches", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());

      const result = await WebhookService.processInbound(
        "fbslug01",
        "GET",
        {},
        {
          "hub.mode": "subscribe",
          "hub.verify_token": "fb-verify-token",
          "hub.challenge": "test_challenge_value",
        }
      );

      expect(result).toEqual({ challenge: "test_challenge_value" });
    });

    it("returns 403 when token does not match", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());

      const result = await WebhookService.processInbound(
        "fbslug01",
        "GET",
        {},
        {
          "hub.mode": "subscribe",
          "hub.verify_token": "wrong_token",
          "hub.challenge": "c",
        }
      );

      expect(result).toEqual({ error: "Verification failed", status: 403 });
    });

    it("returns 403 when mode is not subscribe", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());

      const result = await WebhookService.processInbound(
        "fbslug01",
        "GET",
        {},
        {
          "hub.mode": "unsubscribe",
          "hub.verify_token": "fb-verify-token",
          "hub.challenge": "c",
        }
      );

      expect(result).toEqual({ error: "Verification failed", status: 403 });
    });

    it("returns empty challenge string when hub.challenge is empty", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());

      const result = await WebhookService.processInbound(
        "fbslug01",
        "GET",
        {},
        {
          "hub.mode": "subscribe",
          "hub.verify_token": "fb-verify-token",
          "hub.challenge": "",
        }
      );

      // token is present and matches, but challenge is empty
      // The service checks `token && token === webhook.verifyToken`
      // and hub.challenge is ""
      expect(result).toEqual({ challenge: "" });
    });
  });

  // ─── Facebook Leadgen Processing ──────────────────────────────────────────

  describe("Facebook leadgen processing", () => {
    it("creates lead from field_data (email + name + phone)", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());
      mockLeadServiceCreate.mockResolvedValueOnce(fakeLeadResult());
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const payload = makeFbPayload([
        { name: "email", values: ["john@facebook.com"] },
        { name: "first_name", values: ["John"] },
        { name: "last_name", values: ["Smith"] },
        { name: "phone_number", values: ["+15551234567"] },
      ]);

      const result = await WebhookService.processInbound(
        "fbslug01",
        "POST",
        payload,
        {}
      );

      expect(result).toEqual(
        expect.objectContaining({ success: true })
      );
      expect(mockLeadServiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "john@facebook.com",
          firstName: "John",
          lastName: "Smith",
          phone: "+15551234567",
          source: "FB_MAIN",
        })
      );
    });

    it("creates lead with only email (phone optional)", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());
      mockLeadServiceCreate.mockResolvedValueOnce(fakeLeadResult());
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const payload = makeFbPayload([
        { name: "email", values: ["only-email@fb.com"] },
      ]);

      const result = await WebhookService.processInbound(
        "fbslug01",
        "POST",
        payload,
        {}
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("creates lead with only phone (email optional)", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());
      mockLeadServiceCreate.mockResolvedValueOnce(fakeLeadResult());
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const payload = makeFbPayload([
        { name: "phone_number", values: ["+15559876543"] },
      ]);

      const result = await WebhookService.processInbound(
        "fbslug01",
        "POST",
        payload,
        {}
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(mockLeadServiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({ phone: "+15559876543" })
      );
    });

    it("returns error when field_data has no email or phone", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());

      const payload = makeFbPayload([
        { name: "first_name", values: ["NoContact"] },
      ]);

      const result = await WebhookService.processInbound(
        "fbslug01",
        "POST",
        payload,
        {}
      );

      expect(result).toEqual(
        expect.objectContaining({ error: "No email or phone found in payload" })
      );
    });

    it("returns error for invalid Facebook payload (no entry)", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());

      const result = await WebhookService.processInbound(
        "fbslug01",
        "POST",
        { random: "data" },
        {}
      );

      expect(result).toEqual(
        expect.objectContaining({ error: expect.stringContaining("Invalid Facebook") })
      );
    });

    it("returns error when no field_data and no pageAccessToken", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());

      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  leadgen_id: "lg-999",
                  // no field_data
                },
              },
            ],
          },
        ],
      };

      const result = await WebhookService.processInbound(
        "fbslug01",
        "POST",
        payload,
        {}
      );

      expect(result).toEqual(
        expect.objectContaining({ error: expect.stringContaining("No field_data") })
      );
    });
  });

  // ─── Facebook Graph API Integration ───────────────────────────────────────

  describe("Facebook Graph API integration", () => {
    it("fetches lead data from Graph API when pageAccessToken is set", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ pageAccessToken: "valid-page-token" })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          field_data: [
            { name: "email", values: ["graphapi@fb.com"] },
            { name: "first_name", values: ["Graph"] },
            { name: "last_name", values: ["API"] },
            { name: "phone_number", values: ["+1555000111"] },
          ],
        }),
      });

      mockLeadServiceCreate.mockResolvedValueOnce(fakeLeadResult({ email: "graphapi@fb.com" }));
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const payload = makeFbPayload(
        [{ name: "email", values: ["fallback@fb.com"] }],
        "lg-graph-123"
      );

      const result = await WebhookService.processInbound(
        "fbslug01",
        "POST",
        payload,
        {}
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("graph.facebook.com/v19.0/lg-graph-123")
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("access_token=valid-page-token")
      );
      expect(mockLeadServiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "graphapi@fb.com",
          firstName: "Graph",
          lastName: "API",
        })
      );
    });

    it("falls back to inline field_data when Graph API returns error", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ pageAccessToken: "expired-token" })
      );

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      mockLeadServiceCreate.mockResolvedValueOnce(fakeLeadResult({ email: "fallback@fb.com" }));
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const payload = makeFbPayload([
        { name: "email", values: ["fallback@fb.com"] },
        { name: "first_name", values: ["Fallback"] },
      ]);

      const result = await WebhookService.processInbound(
        "fbslug01",
        "POST",
        payload,
        {}
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(mockLeadServiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({ email: "fallback@fb.com" })
      );
    });

    it("falls back to inline field_data when Graph API returns no field_data", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ pageAccessToken: "token-123" })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "lg-123" }), // no field_data in response
      });

      mockLeadServiceCreate.mockResolvedValueOnce(fakeLeadResult());
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const payload = makeFbPayload([
        { name: "email", values: ["inline@fb.com"] },
      ]);

      const result = await WebhookService.processInbound(
        "fbslug01",
        "POST",
        payload,
        {}
      );

      // Graph API throws "No field_data in Graph API response" -> falls back to inline
      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(mockLeadServiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({ email: "inline@fb.com" })
      );
    });

    it("falls back to inline when Graph API fetch throws network error", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ pageAccessToken: "token-123" })
      );

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      mockLeadServiceCreate.mockResolvedValueOnce(fakeLeadResult());
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const payload = makeFbPayload([
        { name: "email", values: ["inline@fb.com"] },
      ]);

      const result = await WebhookService.processInbound(
        "fbslug01",
        "POST",
        payload,
        {}
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("does not call Graph API when pageAccessToken is null", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ pageAccessToken: null })
      );
      mockLeadServiceCreate.mockResolvedValueOnce(fakeLeadResult());
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const payload = makeFbPayload([
        { name: "email", values: ["nograph@fb.com"] },
      ]);

      await WebhookService.processInbound("fbslug01", "POST", payload, {});

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not call Graph API when leadgen_id is missing", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ pageAccessToken: "token-123" })
      );
      mockLeadServiceCreate.mockResolvedValueOnce(fakeLeadResult());
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  // no leadgen_id
                  field_data: [
                    { name: "email", values: ["noid@fb.com"] },
                  ],
                },
              },
            ],
          },
        ],
      };

      await WebhookService.processInbound("fbslug01", "POST", payload, {});

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ─── Facebook + Campaign Routing ──────────────────────────────────────────

  describe("Facebook with campaign routing", () => {
    it("assigns lead to configured campaign", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ campaignId: "camp-fb" })
      );
      mockLeadServiceCreate.mockResolvedValueOnce(fakeLeadResult());
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());
      mockCampaignLeadFindUnique.mockResolvedValueOnce(null);
      mockCampaignLeadCreate.mockResolvedValueOnce({});

      const payload = makeFbPayload([
        { name: "email", values: ["routed@fb.com"] },
      ]);

      await WebhookService.processInbound("fbslug01", "POST", payload, {});

      expect(mockCampaignLeadCreate).toHaveBeenCalledWith({
        data: { campaignId: "camp-fb", leadId: "lead-fb-1" },
      });
    });
  });

  // ─── Facebook + Sequence Enrollment ───────────────────────────────────────

  describe("Facebook with sequence enrollment", () => {
    it("enrolls lead in configured sequence", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ sequenceId: "seq-fb" })
      );
      mockLeadServiceCreate.mockResolvedValueOnce(fakeLeadResult());
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const payload = makeFbPayload([
        { name: "email", values: ["enrolled@fb.com"] },
      ]);

      await WebhookService.processInbound("fbslug01", "POST", payload, {});

      expect(mockEnrollLead).toHaveBeenCalledWith("seq-fb", "lead-fb-1");
    });
  });

  // ─── Facebook + Field Mapping ─────────────────────────────────────────────

  describe("Facebook with custom field mapping", () => {
    it("applies field mapping to Facebook field_data", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          fieldMapping: JSON.stringify({
            email: "email",
            nome: "firstName",
            cognome: "lastName",
            telefono: "phone",
          }),
        })
      );
      mockLeadServiceCreate.mockResolvedValueOnce(fakeLeadResult());
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      // Facebook field_data with Italian field names
      const payload = makeFbPayload([
        { name: "email", values: ["italian@fb.com"] },
        { name: "nome", values: ["Giuseppe"] },
        { name: "cognome", values: ["Verdi"] },
        { name: "telefono", values: ["+393201111111"] },
      ]);

      const result = await WebhookService.processInbound(
        "fbslug01",
        "POST",
        payload,
        {}
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(mockLeadServiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "italian@fb.com",
          firstName: "Giuseppe",
          lastName: "Verdi",
          phone: "+393201111111",
        })
      );
    });
  });

  // ─── Stats Update ─────────────────────────────────────────────────────────

  describe("Stats update after Facebook inbound", () => {
    it("increments leadCount and updates lastReceivedAt", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook({ leadCount: 5 }));
      mockLeadServiceCreate.mockResolvedValueOnce(fakeLeadResult());
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const payload = makeFbPayload([
        { name: "email", values: ["stats@fb.com"] },
      ]);

      await WebhookService.processInbound("fbslug01", "POST", payload, {});

      expect(mockWebhookUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wh-fb" },
          data: expect.objectContaining({
            lastReceivedAt: expect.any(Date),
            leadCount: { increment: 1 },
          }),
        })
      );
    });
  });
});
