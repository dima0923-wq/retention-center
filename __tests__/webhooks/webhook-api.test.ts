import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock api-auth ----
const mockVerifyApiAuth = vi.fn();
const mockRequirePermission = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  verifyApiAuth: (...args: unknown[]) => mockVerifyApiAuth(...args),
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  authErrorResponse: (error: { message: string; status: number }) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: error.message }, { status: error.status });
  },
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status: number = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  },
}));

// ---- Mock WebhookService ----
const mockList = vi.fn();
const mockCreate = vi.fn();
const mockGetById = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockGetActivity = vi.fn();
const mockTestWebhook = vi.fn();

vi.mock("@/services/webhook.service", () => ({
  WebhookService: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    getActivity: (...args: unknown[]) => mockGetActivity(...args),
    testWebhook: (...args: unknown[]) => mockTestWebhook(...args),
  },
}));

// ---- Mock validators ----
vi.mock("@/lib/validators", async () => {
  const actual = await vi.importActual("@/lib/validators");
  return actual;
});

import {
  GET as listGET,
  POST as createPOST,
} from "@/app/api/webhooks/config/route";
import {
  GET as getByIdGET,
  PATCH as updatePATCH,
  DELETE as deleteDELETE,
} from "@/app/api/webhooks/config/[id]/route";
import { GET as activityGET } from "@/app/api/webhooks/config/[id]/activity/route";
import { POST as testPOST } from "@/app/api/webhooks/config/[id]/test/route";
import { NextRequest } from "next/server";

// ---- Helpers ----
const fakeUser = {
  id: "user-1",
  telegramId: "tg-1",
  username: "admin",
  firstName: "Admin",
  photoUrl: null,
  role: "admin",
  project: "retention_center",
  permissions: ["*:*:*"],
};

function makeRequest(
  url: string,
  method = "GET",
  body?: Record<string, unknown>
): NextRequest {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  return new NextRequest(`http://localhost${url}`, opts);
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("Webhook Config API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyApiAuth.mockResolvedValue(fakeUser);
    mockRequirePermission.mockReturnValue(undefined);
  });

  // ─── GET /api/webhooks/config ─────────────────────────────────────────────

  describe("GET /api/webhooks/config", () => {
    it("returns list of webhooks", async () => {
      const webhooks = [
        { id: "wh-1", name: "Webhook 1", slug: "abc12345" },
        { id: "wh-2", name: "Webhook 2", slug: "xyz67890" },
      ];
      mockList.mockResolvedValueOnce(webhooks);

      const res = await listGET(makeRequest("/api/webhooks/config"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual(webhooks);
    });

    it("returns 401 when not authenticated", async () => {
      const { AuthError } = await import("@/lib/api-auth");
      mockVerifyApiAuth.mockRejectedValueOnce(new AuthError("No token", 401));

      const res = await listGET(makeRequest("/api/webhooks/config"));
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/webhooks/config ────────────────────────────────────────────

  describe("POST /api/webhooks/config", () => {
    it("creates webhook with valid data", async () => {
      const created = {
        id: "wh-new",
        name: "New Webhook",
        slug: "newslug1",
        type: "zapier",
        sourceLabel: "ZAPIER_IT",
      };
      mockCreate.mockResolvedValueOnce(created);

      const res = await createPOST(
        makeRequest("/api/webhooks/config", "POST", {
          name: "New Webhook",
          type: "zapier",
          sourceLabel: "ZAPIER_IT",
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data).toEqual(created);
    });

    it("returns 400 for validation errors (missing name)", async () => {
      const res = await createPOST(
        makeRequest("/api/webhooks/config", "POST", {
          type: "zapier",
          // name is missing
          sourceLabel: "X",
        })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Validation failed");
    });

    it("returns 404 when campaign not found", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Campaign not found"));

      const res = await createPOST(
        makeRequest("/api/webhooks/config", "POST", {
          name: "Test",
          type: "generic",
          sourceLabel: "SRC",
          campaignId: "bad-camp",
        })
      );

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Campaign not found");
    });

    it("returns 404 when sequence not found", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Sequence not found"));

      const res = await createPOST(
        makeRequest("/api/webhooks/config", "POST", {
          name: "Test",
          type: "generic",
          sourceLabel: "SRC",
          sequenceId: "bad-seq",
        })
      );

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/webhooks/config/[id] ────────────────────────────────────────

  describe("GET /api/webhooks/config/[id]", () => {
    it("returns webhook by ID", async () => {
      const webhook = { id: "wh-1", name: "Test", slug: "abc12345" };
      mockGetById.mockResolvedValueOnce(webhook);

      const res = await getByIdGET(
        makeRequest("/api/webhooks/config/wh-1"),
        makeContext("wh-1")
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual(webhook);
    });

    it("returns 404 for non-existent webhook", async () => {
      mockGetById.mockResolvedValueOnce(null);

      const res = await getByIdGET(
        makeRequest("/api/webhooks/config/bad-id"),
        makeContext("bad-id")
      );

      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /api/webhooks/config/[id] ──────────────────────────────────────

  describe("PATCH /api/webhooks/config/[id]", () => {
    it("updates webhook fields", async () => {
      const updated = { id: "wh-1", name: "Updated", isActive: false };
      mockUpdate.mockResolvedValueOnce(updated);

      const res = await updatePATCH(
        makeRequest("/api/webhooks/config/wh-1", "PATCH", { name: "Updated", isActive: false }),
        makeContext("wh-1")
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual(updated);
    });

    it("returns 404 when webhook not found", async () => {
      mockUpdate.mockResolvedValueOnce(null);

      const res = await updatePATCH(
        makeRequest("/api/webhooks/config/bad-id", "PATCH", { name: "X" }),
        makeContext("bad-id")
      );

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid update data", async () => {
      const res = await updatePATCH(
        makeRequest("/api/webhooks/config/wh-1", "PATCH", { type: "invalid_type" }),
        makeContext("wh-1")
      );

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE /api/webhooks/config/[id] ─────────────────────────────────────

  describe("DELETE /api/webhooks/config/[id]", () => {
    it("deletes webhook and returns success", async () => {
      mockDelete.mockResolvedValueOnce({ id: "wh-1" });

      const res = await deleteDELETE(
        makeRequest("/api/webhooks/config/wh-1", "DELETE"),
        makeContext("wh-1")
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true });
    });

    it("returns 404 when webhook not found", async () => {
      mockDelete.mockResolvedValueOnce(null);

      const res = await deleteDELETE(
        makeRequest("/api/webhooks/config/bad-id", "DELETE"),
        makeContext("bad-id")
      );

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/webhooks/config/[id]/activity ───────────────────────────────

  describe("GET /api/webhooks/config/[id]/activity", () => {
    it("returns recent leads", async () => {
      const leads = [
        { id: "lead-1", email: "a@b.com" },
        { id: "lead-2", email: "c@d.com" },
      ];
      mockGetActivity.mockResolvedValueOnce(leads);

      const res = await activityGET(
        makeRequest("/api/webhooks/config/wh-1/activity"),
        makeContext("wh-1")
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual(leads);
    });

    it("respects limit param", async () => {
      mockGetActivity.mockResolvedValueOnce([]);

      await activityGET(
        makeRequest("/api/webhooks/config/wh-1/activity?limit=10"),
        makeContext("wh-1")
      );

      expect(mockGetActivity).toHaveBeenCalledWith("wh-1", 10);
    });

    it("clamps limit to max 100", async () => {
      mockGetActivity.mockResolvedValueOnce([]);

      await activityGET(
        makeRequest("/api/webhooks/config/wh-1/activity?limit=500"),
        makeContext("wh-1")
      );

      expect(mockGetActivity).toHaveBeenCalledWith("wh-1", 100);
    });
  });

  // ─── POST /api/webhooks/config/[id]/test ──────────────────────────────────

  describe("POST /api/webhooks/config/[id]/test", () => {
    it("runs test webhook and returns result", async () => {
      mockTestWebhook.mockResolvedValueOnce({ success: true, leadId: "lead-test" });

      const res = await testPOST(
        makeRequest("/api/webhooks/config/wh-1/test", "POST"),
        makeContext("wh-1")
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true, leadId: "lead-test" });
    });

    it("returns error for non-existent webhook", async () => {
      mockTestWebhook.mockResolvedValueOnce({ error: "Webhook not found" });

      const res = await testPOST(
        makeRequest("/api/webhooks/config/bad-id/test", "POST"),
        makeContext("bad-id")
      );
      const data = await res.json();

      expect(data.error).toBe("Webhook not found");
    });
  });
});
