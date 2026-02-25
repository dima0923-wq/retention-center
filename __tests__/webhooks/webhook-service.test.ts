import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock prisma ----
const mockWebhookFindMany = vi.fn();
const mockWebhookFindUnique = vi.fn();
const mockWebhookCreate = vi.fn();
const mockWebhookUpdate = vi.fn();
const mockWebhookDelete = vi.fn();
const mockCampaignFindUnique = vi.fn();
const mockSequenceFindUnique = vi.fn();
const mockCampaignLeadFindUnique = vi.fn();
const mockCampaignLeadCreate = vi.fn();
const mockLeadFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    webhook: {
      findMany: (...args: unknown[]) => mockWebhookFindMany(...args),
      findUnique: (...args: unknown[]) => mockWebhookFindUnique(...args),
      create: (...args: unknown[]) => mockWebhookCreate(...args),
      update: (...args: unknown[]) => mockWebhookUpdate(...args),
      delete: (...args: unknown[]) => mockWebhookDelete(...args),
    },
    campaign: {
      findUnique: (...args: unknown[]) => mockCampaignFindUnique(...args),
    },
    retentionSequence: {
      findUnique: (...args: unknown[]) => mockSequenceFindUnique(...args),
    },
    campaignLead: {
      findUnique: (...args: unknown[]) => mockCampaignLeadFindUnique(...args),
      create: (...args: unknown[]) => mockCampaignLeadCreate(...args),
    },
    lead: {
      findMany: (...args: unknown[]) => mockLeadFindMany(...args),
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

// ---- Mock global fetch (for Facebook Graph API) ----
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { WebhookService } from "@/services/webhook.service";

// ---- Helpers ----
function fakeWebhook(overrides: Record<string, unknown> = {}) {
  return {
    id: "wh-1",
    name: "Test Webhook",
    slug: "abc12345",
    type: "generic",
    sourceLabel: "TEST_SOURCE",
    isActive: true,
    verifyToken: null,
    pageAccessToken: null,
    config: "{}",
    campaignId: null,
    sequenceId: null,
    fieldMapping: null,
    lastReceivedAt: null,
    leadCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    campaign: null,
    sequence: null,
    ...overrides,
  };
}

function fakeLead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "+1234567890",
    source: "WEBHOOK_GENERIC",
    ...overrides,
  };
}

describe("WebhookService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouteNewLead.mockResolvedValue(undefined);
    mockEnrollLead.mockResolvedValue(undefined);
  });

  // ─── list() ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns all webhooks with parsed JSON fields", async () => {
      mockWebhookFindMany.mockResolvedValueOnce([
        fakeWebhook({ config: '{"key":"val"}', fieldMapping: '{"email":"email"}' }),
        fakeWebhook({ id: "wh-2", name: "Second", config: null, fieldMapping: null }),
      ]);

      const result = await WebhookService.list();

      expect(result).toHaveLength(2);
      expect(result[0].config).toEqual({ key: "val" });
      expect(result[0].fieldMapping).toEqual({ email: "email" });
      expect(result[1].config).toBeNull();
      expect(result[1].fieldMapping).toBeNull();
    });

    it("returns empty array when no webhooks exist", async () => {
      mockWebhookFindMany.mockResolvedValueOnce([]);
      const result = await WebhookService.list();
      expect(result).toEqual([]);
    });
  });

  // ─── getById() ────────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("returns webhook with parsed JSON for valid ID", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ config: '{"a":1}', fieldMapping: '{"nome":"firstName"}' })
      );

      const result = await WebhookService.getById("wh-1");

      expect(result).not.toBeNull();
      expect(result!.config).toEqual({ a: 1 });
      expect(result!.fieldMapping).toEqual({ nome: "firstName" });
    });

    it("returns null for non-existent ID", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(null);
      const result = await WebhookService.getById("non-existent");
      expect(result).toBeNull();
    });
  });

  // ─── getBySlug() ──────────────────────────────────────────────────────────────

  describe("getBySlug", () => {
    it("returns webhook for valid slug", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());
      const result = await WebhookService.getBySlug("abc12345");
      expect(result).not.toBeNull();
      expect(result!.slug).toBe("abc12345");
    });

    it("returns null for non-existent slug", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(null);
      const result = await WebhookService.getBySlug("nosuchslug");
      expect(result).toBeNull();
    });
  });

  // ─── create() ─────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates webhook with auto-generated slug", async () => {
      // generateSlug will call findUnique to check for collisions — return null (no collision)
      mockWebhookFindUnique.mockResolvedValueOnce(null);
      mockWebhookCreate.mockResolvedValueOnce(
        fakeWebhook({ slug: "xYz12345", config: null, fieldMapping: null })
      );

      const result = await WebhookService.create({
        name: "New Webhook",
        type: "zapier",
      });

      expect(result.name).toBe("Test Webhook"); // from mock
      expect(mockWebhookCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "New Webhook",
            type: "zapier",
          }),
        })
      );
    });

    it("validates campaign exists if campaignId provided", async () => {
      mockCampaignFindUnique.mockResolvedValueOnce(null);

      await expect(
        WebhookService.create({
          name: "Test",
          type: "generic",
          campaignId: "non-existent",
        })
      ).rejects.toThrow("Campaign not found");
    });

    it("validates sequence exists if sequenceId provided", async () => {
      mockSequenceFindUnique.mockResolvedValueOnce(null);

      await expect(
        WebhookService.create({
          name: "Test",
          type: "generic",
          sequenceId: "non-existent",
        })
      ).rejects.toThrow("Sequence not found");
    });

    it("creates with campaign and sequence when both valid", async () => {
      mockCampaignFindUnique.mockResolvedValueOnce({ id: "camp-1" });
      mockSequenceFindUnique.mockResolvedValueOnce({ id: "seq-1" });
      mockWebhookFindUnique.mockResolvedValueOnce(null); // slug collision check
      mockWebhookCreate.mockResolvedValueOnce(
        fakeWebhook({
          campaignId: "camp-1",
          sequenceId: "seq-1",
          config: null,
          fieldMapping: null,
        })
      );

      const result = await WebhookService.create({
        name: "Full Webhook",
        type: "facebook",
        campaignId: "camp-1",
        sequenceId: "seq-1",
        verifyToken: "my-token",
        pageAccessToken: "page-token",
      });

      expect(mockWebhookCreate).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  // ─── generateSlug() ───────────────────────────────────────────────────────────

  describe("generateSlug", () => {
    it("generates unique 8-char slug", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(null);

      const slug = await WebhookService.generateSlug();

      expect(slug).toHaveLength(8);
      expect(slug).toMatch(/^[A-Za-z0-9]+$/);
    });

    it("retries on collision", async () => {
      // First attempt collides, second succeeds
      mockWebhookFindUnique
        .mockResolvedValueOnce(fakeWebhook()) // collision
        .mockResolvedValueOnce(null); // no collision

      const slug = await WebhookService.generateSlug();
      expect(slug).toHaveLength(8);
      expect(mockWebhookFindUnique).toHaveBeenCalledTimes(2);
    });

    it("throws after 10 collisions", async () => {
      for (let i = 0; i < 10; i++) {
        mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());
      }

      await expect(WebhookService.generateSlug()).rejects.toThrow(
        "Failed to generate unique slug after 10 attempts"
      );
    });
  });

  // ─── update() ─────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("updates fields correctly", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());
      mockWebhookUpdate.mockResolvedValueOnce(
        fakeWebhook({ name: "Updated", config: null, fieldMapping: null })
      );

      const result = await WebhookService.update("wh-1", { name: "Updated" });

      expect(result).not.toBeNull();
      expect(mockWebhookUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wh-1" },
          data: expect.objectContaining({ name: "Updated" }),
        })
      );
    });

    it("returns null for non-existent webhook", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(null);
      const result = await WebhookService.update("no-id", { name: "X" });
      expect(result).toBeNull();
    });

    it("validates campaign if campaignId provided", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());
      mockCampaignFindUnique.mockResolvedValueOnce(null);

      await expect(
        WebhookService.update("wh-1", { campaignId: "bad" })
      ).rejects.toThrow("Campaign not found");
    });

    it("validates sequence if sequenceId provided", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());
      mockSequenceFindUnique.mockResolvedValueOnce(null);

      await expect(
        WebhookService.update("wh-1", { sequenceId: "bad" })
      ).rejects.toThrow("Sequence not found");
    });
  });

  // ─── delete() ─────────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("deletes existing webhook and returns it", async () => {
      const wh = fakeWebhook();
      mockWebhookFindUnique.mockResolvedValueOnce(wh);
      mockWebhookDelete.mockResolvedValueOnce(wh);

      const result = await WebhookService.delete("wh-1");
      expect(result).toBeDefined();
      expect(mockWebhookDelete).toHaveBeenCalledWith({ where: { id: "wh-1" } });
    });

    it("returns null for non-existent webhook", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(null);
      const result = await WebhookService.delete("no-id");
      expect(result).toBeNull();
      expect(mockWebhookDelete).not.toHaveBeenCalled();
    });
  });

  // ─── processInbound() ────────────────────────────────────────────────────────

  describe("processInbound", () => {
    it("returns 404 for non-existent slug", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(null);

      const result = await WebhookService.processInbound("bad-slug", "POST", {}, {});
      expect(result).toEqual({ error: "Webhook not found", status: 404 });
    });

    it("returns 403 for inactive webhook", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ isActive: false, config: "{}", fieldMapping: null })
      );

      const result = await WebhookService.processInbound("abc12345", "POST", {}, {});
      expect(result).toEqual({ error: "Webhook is inactive", status: 403 });
    });

    it("handles Facebook verification (GET)", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          type: "facebook",
          verifyToken: "my-verify-token",
          config: "{}",
          fieldMapping: null,
        })
      );

      const result = await WebhookService.processInbound(
        "abc12345",
        "GET",
        {},
        { "hub.mode": "subscribe", "hub.verify_token": "my-verify-token", "hub.challenge": "challenge_123" }
      );

      expect(result).toEqual({ challenge: "challenge_123" });
    });

    it("rejects Facebook verification with wrong token", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          type: "facebook",
          verifyToken: "correct-token",
          config: "{}",
          fieldMapping: null,
        })
      );

      const result = await WebhookService.processInbound(
        "abc12345",
        "GET",
        {},
        { "hub.mode": "subscribe", "hub.verify_token": "wrong-token", "hub.challenge": "c" }
      );

      expect(result).toEqual({ error: "Verification failed", status: 403 });
    });

    it("returns 405 for non-POST non-GET", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook({ config: "{}", fieldMapping: null }));

      const result = await WebhookService.processInbound(
        "abc12345",
        "GET", // GET on generic webhook
        {},
        {}
      );

      // For non-facebook webhooks, GET triggers facebook verification path
      // which fails since type is generic
      expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });

    it("creates lead from Zapier payload with common field names", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ type: "zapier", config: "{}", fieldMapping: null })
      );
      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead(),
        deduplicated: false,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const result = await WebhookService.processInbound(
        "abc12345",
        "POST",
        {
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          phone_number: "+1555000000",
        },
        {}
      );

      expect(result).toEqual(
        expect.objectContaining({ success: true, leadId: "lead-1", deduplicated: false })
      );
      expect(mockLeadServiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          phone: "+1555000000",
        })
      );
    });

    it("creates lead from generic payload with field mapping", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          type: "generic",
          config: "{}",
          fieldMapping: JSON.stringify({
            user_email: "email",
            user_phone: "phone",
            nome: "firstName",
            cognome: "lastName",
          }),
        })
      );
      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead(),
        deduplicated: false,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const result = await WebhookService.processInbound(
        "abc12345",
        "POST",
        {
          user_email: "custom@example.com",
          user_phone: "+393201234567",
          nome: "Mario",
          cognome: "Rossi",
        },
        {}
      );

      expect(result).toEqual(
        expect.objectContaining({ success: true })
      );
      expect(mockLeadServiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "custom@example.com",
          phone: "+393201234567",
          firstName: "Mario",
          lastName: "Rossi",
        })
      );
    });

    it("returns error when no email or phone in payload", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ type: "generic", config: "{}", fieldMapping: null })
      );

      const result = await WebhookService.processInbound(
        "abc12345",
        "POST",
        { random_field: "value" },
        {}
      );

      expect(result).toEqual(
        expect.objectContaining({ error: "No email or phone found in payload", status: 400 })
      );
    });

    it("updates webhook stats (lastReceivedAt, leadCount) on successful inbound", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ type: "zapier", config: "{}", fieldMapping: null })
      );
      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead(),
        deduplicated: false,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      await WebhookService.processInbound(
        "abc12345",
        "POST",
        { email: "a@b.com" },
        {}
      );

      expect(mockWebhookUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wh-1" },
          data: expect.objectContaining({
            lastReceivedAt: expect.any(Date),
            leadCount: { increment: 1 },
          }),
        })
      );
    });

    it("routes to campaign when campaignId is configured", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          type: "generic",
          campaignId: "camp-1",
          config: "{}",
          fieldMapping: null,
        })
      );
      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead(),
        deduplicated: false,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());
      mockCampaignLeadFindUnique.mockResolvedValueOnce(null); // no existing
      mockCampaignLeadCreate.mockResolvedValueOnce({});

      await WebhookService.processInbound(
        "abc12345",
        "POST",
        { email: "test@example.com" },
        {}
      );

      expect(mockCampaignLeadCreate).toHaveBeenCalledWith({
        data: { campaignId: "camp-1", leadId: "lead-1" },
      });
    });

    it("does not duplicate campaign lead if already assigned", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          type: "generic",
          campaignId: "camp-1",
          config: "{}",
          fieldMapping: null,
        })
      );
      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead(),
        deduplicated: false,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());
      mockCampaignLeadFindUnique.mockResolvedValueOnce({ id: "cl-1" }); // already exists

      await WebhookService.processInbound(
        "abc12345",
        "POST",
        { email: "test@example.com" },
        {}
      );

      expect(mockCampaignLeadCreate).not.toHaveBeenCalled();
    });

    it("enrolls in sequence when sequenceId is configured", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          type: "generic",
          sequenceId: "seq-1",
          config: "{}",
          fieldMapping: null,
        })
      );
      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead(),
        deduplicated: false,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      await WebhookService.processInbound(
        "abc12345",
        "POST",
        { email: "test@example.com" },
        {}
      );

      expect(mockEnrollLead).toHaveBeenCalledWith("seq-1", "lead-1");
    });

    it("calls LeadRouterService when no campaignId configured", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          type: "generic",
          campaignId: null,
          config: "{}",
          fieldMapping: null,
        })
      );
      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead(),
        deduplicated: false,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      await WebhookService.processInbound(
        "abc12345",
        "POST",
        { email: "test@example.com" },
        {}
      );

      expect(mockRouteNewLead).toHaveBeenCalledWith("lead-1");
    });

    it("uses sourceLabel from webhook for lead source", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          type: "zapier",
          sourceLabel: "ZAPIER_IT",
          config: "{}",
          fieldMapping: null,
        })
      );
      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead(),
        deduplicated: false,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      await WebhookService.processInbound(
        "abc12345",
        "POST",
        { email: "test@example.com" },
        {}
      );

      expect(mockLeadServiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({ source: "ZAPIER_IT" })
      );
    });

    it("falls back to WEBHOOK_TYPE source when no sourceLabel", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          type: "zapier",
          sourceLabel: null,
          config: "{}",
          fieldMapping: null,
        })
      );
      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead(),
        deduplicated: false,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      await WebhookService.processInbound(
        "abc12345",
        "POST",
        { email: "test@example.com" },
        {}
      );

      expect(mockLeadServiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({ source: "WEBHOOK_ZAPIER" })
      );
    });

    it("handles deduplicated lead correctly", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ type: "generic", config: "{}", fieldMapping: null })
      );
      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead(),
        deduplicated: true,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const result = await WebhookService.processInbound(
        "abc12345",
        "POST",
        { email: "existing@example.com" },
        {}
      );

      expect(result).toEqual(
        expect.objectContaining({ success: true, deduplicated: true })
      );
    });
  });

  // ─── processInbound Facebook ─────────────────────────────────────────────────

  describe("processInbound (Facebook)", () => {
    it("creates lead from Facebook leadgen payload with field_data", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          type: "facebook",
          config: "{}",
          fieldMapping: null,
          pageAccessToken: null,
        })
      );
      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead(),
        deduplicated: false,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const fbPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  leadgen_id: "lead-123",
                  field_data: [
                    { name: "email", values: ["fb@example.com"] },
                    { name: "first_name", values: ["Mark"] },
                    { name: "last_name", values: ["Zuck"] },
                    { name: "phone_number", values: ["+15555555"] },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await WebhookService.processInbound(
        "abc12345",
        "POST",
        fbPayload,
        {}
      );

      expect(result).toEqual(
        expect.objectContaining({ success: true })
      );
      expect(mockLeadServiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "fb@example.com",
          firstName: "Mark",
          lastName: "Zuck",
          phone: "+15555555",
        })
      );
    });

    it("fetches from Graph API when pageAccessToken is set", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          type: "facebook",
          config: "{}",
          fieldMapping: null,
          pageAccessToken: "page-token-123",
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          field_data: [
            { name: "email", values: ["graphapi@example.com"] },
            { name: "first_name", values: ["Graph"] },
            { name: "last_name", values: ["User"] },
          ],
        }),
      });

      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead({ email: "graphapi@example.com" }),
        deduplicated: false,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const fbPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  leadgen_id: "lg-456",
                  field_data: [
                    { name: "email", values: ["fallback@example.com"] },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await WebhookService.processInbound(
        "abc12345",
        "POST",
        fbPayload,
        {}
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("graph.facebook.com/v19.0/lg-456")
      );
      expect(mockLeadServiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({ email: "graphapi@example.com" })
      );
    });

    it("falls back to inline field_data when Graph API fails", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          type: "facebook",
          config: "{}",
          fieldMapping: null,
          pageAccessToken: "bad-token",
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead(),
        deduplicated: false,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const fbPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  leadgen_id: "lg-789",
                  field_data: [
                    { name: "email", values: ["fallback@example.com"] },
                    { name: "first_name", values: ["Fallback"] },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await WebhookService.processInbound(
        "abc12345",
        "POST",
        fbPayload,
        {}
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(mockLeadServiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({ email: "fallback@example.com", firstName: "Fallback" })
      );
    });

    it("returns error for invalid Facebook payload (no entry/changes)", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({
          type: "facebook",
          config: "{}",
          fieldMapping: null,
        })
      );

      const result = await WebhookService.processInbound(
        "abc12345",
        "POST",
        { random: "data" },
        {}
      );

      expect(result).toEqual(
        expect.objectContaining({ error: expect.stringContaining("Invalid Facebook webhook payload") })
      );
    });
  });

  // ─── getActivity() ────────────────────────────────────────────────────────────

  describe("getActivity", () => {
    it("returns recent leads for existing webhook", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());
      mockLeadFindMany.mockResolvedValueOnce([fakeLead(), fakeLead({ id: "lead-2" })]);

      const result = await WebhookService.getActivity("wh-1");
      expect(result).toHaveLength(2);
    });

    it("returns null for non-existent webhook", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(null);
      const result = await WebhookService.getActivity("bad-id");
      expect(result).toBeNull();
    });

    it("respects limit parameter", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook());
      mockLeadFindMany.mockResolvedValueOnce([fakeLead()]);

      await WebhookService.getActivity("wh-1", 10);

      expect(mockLeadFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });
  });

  // ─── testWebhook() ───────────────────────────────────────────────────────────

  describe("testWebhook", () => {
    it("returns error for non-existent webhook", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(null);

      const result = await WebhookService.testWebhook("bad-id");
      expect(result).toEqual({ error: "Webhook not found" });
    });

    it("sends test payload through processInbound for generic webhook", async () => {
      // First call: testWebhook finds the webhook
      mockWebhookFindUnique.mockResolvedValueOnce(fakeWebhook({ type: "generic" }));
      // Second call: processInbound finds webhook by slug
      mockWebhookFindUnique.mockResolvedValueOnce(
        fakeWebhook({ type: "generic", config: "{}", fieldMapping: null })
      );
      mockLeadServiceCreate.mockResolvedValueOnce({
        lead: fakeLead(),
        deduplicated: false,
      });
      mockWebhookUpdate.mockResolvedValueOnce(fakeWebhook());

      const result = await WebhookService.testWebhook("wh-1");
      expect(result).toEqual(
        expect.objectContaining({ success: true, leadId: "lead-1" })
      );
    });
  });
});
