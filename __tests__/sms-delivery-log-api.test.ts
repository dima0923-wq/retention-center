import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock auth ----
const mockVerifyApiAuth = vi.fn();
const mockRequirePermission = vi.fn();

vi.mock("@/lib/api-auth", () => {
  class AuthError extends Error {
    status: number;
    constructor(message: string, status: number = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  }
  return {
    verifyApiAuth: (...args: unknown[]) => mockVerifyApiAuth(...args),
    requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
    AuthError,
    authErrorResponse: (error: unknown) => {
      if (error instanceof AuthError) {
        return Response.json(
          { error: error.message },
          { status: error.status }
        );
      }
      return Response.json({ error: "Internal server error" }, { status: 500 });
    },
  };
});

// ---- Mock delivery log service ----
const mockListEvents = vi.fn();
const mockGetEventsForAttempt = vi.fn();

vi.mock("@/services/sms-delivery-log.service", () => ({
  SmsDeliveryLogService: {
    listEvents: (...args: unknown[]) => mockListEvents(...args),
    getEventsForAttempt: (...args: unknown[]) =>
      mockGetEventsForAttempt(...args),
  },
}));

import { GET as getList } from "@/app/api/sms-delivery-log/route";
import { GET as getByAttempt } from "@/app/api/sms-delivery-log/[attemptId]/route";
import { AuthError } from "@/lib/api-auth";
import { NextRequest } from "next/server";

const authenticatedUser = {
  id: "user-1",
  telegramId: "123",
  username: "testuser",
  firstName: "Test",
  photoUrl: null,
  role: "admin",
  project: "retention_center",
  permissions: ["retention:analytics:view"],
};

function makeGetRequest(
  url: string,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: "GET",
    headers: {
      authorization: "Bearer test-token",
      ...headers,
    },
  });
}

describe("GET /api/sms-delivery-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyApiAuth.mockResolvedValue(authenticatedUser);
    mockRequirePermission.mockReturnValue(undefined);
  });

  it("returns paginated events", async () => {
    const mockResult = {
      data: [
        {
          id: "evt-1",
          provider: "sms-retail",
          status: "DELIVERED",
        },
      ],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    };
    mockListEvents.mockResolvedValueOnce(mockResult);

    const res = await getList(makeGetRequest("/api/sms-delivery-log"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.pagination.total).toBe(1);
  });

  it("passes query params as filters", async () => {
    mockListEvents.mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    await getList(
      makeGetRequest(
        "/api/sms-delivery-log?status=FAILED&provider=23telecom&page=2&limit=10"
      )
    );

    expect(mockListEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "FAILED",
        provider: "23telecom",
        page: 2,
        limit: 10,
      })
    );
  });

  it("returns 401 without auth token", async () => {
    mockVerifyApiAuth.mockRejectedValueOnce(
      new AuthError("No authentication token provided", 401)
    );

    const res = await getList(
      new NextRequest("http://localhost/api/sms-delivery-log", { method: "GET" })
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it("returns 403 without required permission", async () => {
    mockVerifyApiAuth.mockResolvedValueOnce(authenticatedUser);
    mockRequirePermission.mockImplementationOnce(() => {
      throw new AuthError("Forbidden: missing permission", 403);
    });

    const res = await getList(makeGetRequest("/api/sms-delivery-log"));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("Forbidden");
  });
});

describe("GET /api/sms-delivery-log/[attemptId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyApiAuth.mockResolvedValue(authenticatedUser);
    mockRequirePermission.mockReturnValue(undefined);
  });

  it("returns events for a specific attempt", async () => {
    const mockResult = {
      attempt: {
        id: "att-1",
        leadId: "lead-1",
        channel: "SMS",
        status: "SUCCESS",
      },
      events: [
        { id: "evt-1", status: "DELIVERED", rawStatus: "delivered" },
      ],
    };
    mockGetEventsForAttempt.mockResolvedValueOnce(mockResult);

    const res = await getByAttempt(
      makeGetRequest("/api/sms-delivery-log/att-1"),
      { params: Promise.resolve({ attemptId: "att-1" }) }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.attempt.id).toBe("att-1");
    expect(data.events).toHaveLength(1);
  });

  it("returns 404 when attempt not found", async () => {
    mockGetEventsForAttempt.mockResolvedValueOnce(null);

    const res = await getByAttempt(
      makeGetRequest("/api/sms-delivery-log/nonexistent"),
      { params: Promise.resolve({ attemptId: "nonexistent" }) }
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Contact attempt not found");
  });

  it("returns 401 without auth token", async () => {
    mockVerifyApiAuth.mockRejectedValueOnce(
      new AuthError("No authentication token provided", 401)
    );

    const res = await getByAttempt(
      new NextRequest("http://localhost/api/sms-delivery-log/att-1", {
        method: "GET",
      }),
      { params: Promise.resolve({ attemptId: "att-1" }) }
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBeDefined();
  });
});
