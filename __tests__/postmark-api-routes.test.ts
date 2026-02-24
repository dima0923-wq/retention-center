import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock PostmarkService ----
const mockGetOutboundStats = vi.fn();
const mockGetBounces = vi.fn();
const mockGetDeliveryStatistics = vi.fn();
const mockListMessageStreams = vi.fn();
const mockListSenderSignatures = vi.fn();
const mockCreateSenderSignature = vi.fn();
const mockListDomains = vi.fn();
const mockVerifyDomainDKIM = vi.fn();
const mockVerifyDomainReturnPath = vi.fn();

vi.mock("@/services/channel/postmark.service", () => ({
  PostmarkService: {
    getOutboundStats: (...args: unknown[]) => mockGetOutboundStats(...args),
    getBounces: (...args: unknown[]) => mockGetBounces(...args),
    getDeliveryStatistics: (...args: unknown[]) => mockGetDeliveryStatistics(...args),
    listMessageStreams: (...args: unknown[]) => mockListMessageStreams(...args),
    listSenderSignatures: (...args: unknown[]) => mockListSenderSignatures(...args),
    createSenderSignature: (...args: unknown[]) => mockCreateSenderSignature(...args),
    listDomains: (...args: unknown[]) => mockListDomains(...args),
    verifyDomainDKIM: (...args: unknown[]) => mockVerifyDomainDKIM(...args),
    verifyDomainReturnPath: (...args: unknown[]) => mockVerifyDomainReturnPath(...args),
  },
}));

// ---- Mock auth ----
vi.mock("@/lib/api-auth", () => ({
  verifyApiAuth: vi.fn().mockResolvedValue({ id: "user-1", permissions: ["retention:templates:manage"] }),
  requirePermission: vi.fn(),
  AuthError: class AuthError extends Error { statusCode = 401; },
  authErrorResponse: vi.fn(),
}));

import { GET as getStats } from "@/app/api/integrations/postmark/stats/route";
import { GET as getBounces } from "@/app/api/integrations/postmark/bounces/route";
import { GET as getStreams } from "@/app/api/integrations/postmark/streams/route";
import { GET as getSenders, POST as createSender } from "@/app/api/integrations/postmark/senders/route";
import { GET as getDomains, POST as domainAction } from "@/app/api/integrations/postmark/domains/route";

type RouteHandler = (req: Request) => Promise<Response>;

function makeGet(url: string): Parameters<RouteHandler>[0] {
  return new Request(url, { method: "GET" }) as Parameters<RouteHandler>[0];
}

function makePost(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Postmark API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- Stats ----
  describe("GET /api/integrations/postmark/stats", () => {
    it("returns overview stats on success", async () => {
      const stats = { Sent: 100, Bounced: 5, Opens: 50 };
      mockGetOutboundStats.mockResolvedValueOnce(stats);

      const res = await getStats(makeGet("http://localhost/api/integrations/postmark/stats") as Parameters<typeof getStats>[0]);
      const data = await res.json();

      expect(data).toEqual({ overview: stats });
      expect(res.status).toBe(200);
    });

    it("returns 502 when stats returns error", async () => {
      mockGetOutboundStats.mockResolvedValueOnce({ error: "Not configured" });

      const res = await getStats(makeGet("http://localhost/api/integrations/postmark/stats") as Parameters<typeof getStats>[0]);
      const data = await res.json();

      expect(data).toEqual({ error: "Not configured" });
      expect(res.status).toBe(502);
    });
  });

  // ---- Bounces ----
  describe("GET /api/integrations/postmark/bounces", () => {
    it("returns bounces with delivery stats", async () => {
      mockGetBounces.mockResolvedValueOnce({
        Bounces: [{ ID: 1, Email: "a@b.com" }],
        TotalCount: 1,
      });
      mockGetDeliveryStatistics.mockResolvedValueOnce({ InactiveMails: 5 });

      const res = await getBounces(makeGet("http://localhost/api/integrations/postmark/bounces") as Parameters<typeof getBounces>[0]);
      const data = await res.json();

      expect(data.bounces).toHaveLength(1);
      expect(data.totalCount).toBe(1);
      expect(data.deliveryStats).toEqual({ InactiveMails: 5 });
    });

    it("returns 502 when bounces returns error", async () => {
      mockGetBounces.mockResolvedValueOnce({ error: "Not configured" });
      mockGetDeliveryStatistics.mockResolvedValueOnce(null);

      const res = await getBounces(makeGet("http://localhost/api/integrations/postmark/bounces") as Parameters<typeof getBounces>[0]);
      const data = await res.json();

      expect(data.error).toBe("Not configured");
      expect(res.status).toBe(502);
    });

    it("respects count and offset params", async () => {
      mockGetBounces.mockResolvedValueOnce({ Bounces: [], TotalCount: 0 });
      mockGetDeliveryStatistics.mockResolvedValueOnce(null);

      await getBounces(makeGet("http://localhost/api/integrations/postmark/bounces?count=10&offset=5") as Parameters<typeof getBounces>[0]);

      expect(mockGetBounces).toHaveBeenCalledWith({ count: 10, offset: 5 });
    });

    it("caps count at 100", async () => {
      mockGetBounces.mockResolvedValueOnce({ Bounces: [], TotalCount: 0 });
      mockGetDeliveryStatistics.mockResolvedValueOnce(null);

      await getBounces(makeGet("http://localhost/api/integrations/postmark/bounces?count=500") as Parameters<typeof getBounces>[0]);

      expect(mockGetBounces).toHaveBeenCalledWith({ count: 100, offset: 0 });
    });
  });

  // ---- Streams ----
  describe("GET /api/integrations/postmark/streams", () => {
    it("returns message streams", async () => {
      mockListMessageStreams.mockResolvedValueOnce({
        MessageStreams: [{ ID: "outbound", Name: "Outbound" }],
        TotalCount: 1,
      });

      const res = await getStreams(makeGet("http://localhost/api/integrations/postmark/streams") as Parameters<typeof getStreams>[0]);
      const data = await res.json();

      expect(data.streams).toHaveLength(1);
      expect(data.totalCount).toBe(1);
    });

    it("returns 502 on error", async () => {
      mockListMessageStreams.mockResolvedValueOnce({ error: "Not configured" });

      const res = await getStreams(makeGet("http://localhost/api/integrations/postmark/streams") as Parameters<typeof getStreams>[0]);
      expect(res.status).toBe(502);
    });
  });

  // ---- Senders ----
  describe("GET /api/integrations/postmark/senders", () => {
    it("returns sender signatures", async () => {
      const senders = { SenderSignatures: [{ ID: 1 }], TotalCount: 1 };
      mockListSenderSignatures.mockResolvedValueOnce(senders);

      const res = await getSenders(makeGet("http://localhost/api/integrations/postmark/senders") as Parameters<typeof getSenders>[0]);
      const data = await res.json();

      expect(data).toEqual(senders);
    });
  });

  describe("POST /api/integrations/postmark/senders", () => {
    it("creates sender signature", async () => {
      const created = { ID: 2, FromEmail: "test@example.com", Name: "Test" };
      mockCreateSenderSignature.mockResolvedValueOnce(created);

      const res = await createSender(
        makePost("http://localhost/api/integrations/postmark/senders", {
          fromEmail: "test@example.com",
          name: "Test",
        }) as Parameters<typeof createSender>[0]
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data).toEqual(created);
    });

    it("returns 400 when missing required fields", async () => {
      const res = await createSender(
        makePost("http://localhost/api/integrations/postmark/senders", {
          fromEmail: "test@example.com",
        }) as Parameters<typeof createSender>[0]
      );

      expect(res.status).toBe(400);
    });
  });

  // ---- Domains ----
  describe("GET /api/integrations/postmark/domains", () => {
    it("returns domains list", async () => {
      const domains = { Domains: [{ ID: 1 }], TotalCount: 1 };
      mockListDomains.mockResolvedValueOnce(domains);

      const res = await getDomains(makeGet("http://localhost/api/integrations/postmark/domains") as Parameters<typeof getDomains>[0]);
      const data = await res.json();

      expect(data).toEqual(domains);
    });
  });

  describe("POST /api/integrations/postmark/domains", () => {
    it("verifies DKIM", async () => {
      mockVerifyDomainDKIM.mockResolvedValueOnce({ ID: 1, DKIMVerified: true });

      const res = await domainAction(
        makePost("http://localhost/api/integrations/postmark/domains", {
          domainId: 1,
          action: "verifyDKIM",
        }) as Parameters<typeof domainAction>[0]
      );
      const data = await res.json();

      expect(mockVerifyDomainDKIM).toHaveBeenCalledWith(1);
      expect(data.DKIMVerified).toBe(true);
    });

    it("verifies ReturnPath", async () => {
      mockVerifyDomainReturnPath.mockResolvedValueOnce({ ID: 1, ReturnPathVerified: true });

      const res = await domainAction(
        makePost("http://localhost/api/integrations/postmark/domains", {
          domainId: 1,
          action: "verifyReturnPath",
        }) as Parameters<typeof domainAction>[0]
      );

      expect(mockVerifyDomainReturnPath).toHaveBeenCalledWith(1);
    });

    it("returns 400 for invalid action", async () => {
      const res = await domainAction(
        makePost("http://localhost/api/integrations/postmark/domains", {
          domainId: 1,
          action: "invalidAction",
        }) as Parameters<typeof domainAction>[0]
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when missing required fields", async () => {
      const res = await domainAction(
        makePost("http://localhost/api/integrations/postmark/domains", {}) as Parameters<typeof domainAction>[0]
      );

      expect(res.status).toBe(400);
    });
  });
});
