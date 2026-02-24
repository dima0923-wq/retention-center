import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----
const mockGetById = vi.fn();
const mockRenderTemplate = vi.fn();
const mockPostmarkSendEmail = vi.fn();
const mockLeadFindUnique = vi.fn();

vi.mock("@/services/email-template.service", () => ({
  EmailTemplateService: {
    getById: (...args: unknown[]) => mockGetById(...args),
    renderTemplate: (...args: unknown[]) => mockRenderTemplate(...args),
  },
}));

vi.mock("@/services/channel/postmark.service", () => ({
  PostmarkService: {
    sendEmail: (...args: unknown[]) => mockPostmarkSendEmail(...args),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: {
      findUnique: (...args: unknown[]) => mockLeadFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/api-auth", () => ({
  verifyApiAuth: vi.fn().mockResolvedValue({ id: "user-1", permissions: ["retention:templates:manage"] }),
  requirePermission: vi.fn(),
  AuthError: class AuthError extends Error { statusCode = 401; },
  authErrorResponse: vi.fn(),
}));

import { POST } from "@/app/api/email-templates/[id]/send/route";

function makeRequest(body: unknown): Parameters<typeof POST>[0] {
  return new Request("http://localhost/api/email-templates/tpl-1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0];
}

function routeContext(id = "tpl-1"): Parameters<typeof POST>[1] {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/email-templates/[id]/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends email successfully with rendered template", async () => {
    const template = {
      id: "tpl-1",
      name: "Welcome",
      subject: "Hello {{firstName}}",
      htmlBody: "<p>Hi {{firstName}}</p>",
      textBody: null,
      fromEmail: "sender@example.com",
      fromName: "Team",
      isActive: true,
    };
    const lead = {
      id: "lead-1",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: null,
    };

    mockGetById.mockResolvedValueOnce(template);
    mockLeadFindUnique.mockResolvedValueOnce(lead);
    mockRenderTemplate.mockReturnValueOnce({
      subject: "Hello Jane",
      htmlBody: "<p>Hi Jane</p>",
      textBody: null,
    });
    mockPostmarkSendEmail.mockResolvedValueOnce({ providerRef: "msg-123" });

    const res = await POST(makeRequest({ leadId: "lead-1" }), routeContext());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.messageId).toBe("msg-123");
    expect(data.templateName).toBe("Welcome");
    expect(data.to).toBe("jane@example.com");
    expect(mockRenderTemplate).toHaveBeenCalledWith(
      template,
      expect.objectContaining({ firstName: "Jane", lastName: "Smith" })
    );
  });

  it("returns 400 when leadId is missing", async () => {
    const res = await POST(makeRequest({}), routeContext());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Validation failed");
  });

  it("returns 404 when template not found", async () => {
    mockGetById.mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ leadId: "lead-1" }), routeContext());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Email template not found");
  });

  it("returns 404 when lead not found", async () => {
    mockGetById.mockResolvedValueOnce({ id: "tpl-1", isActive: true });
    mockLeadFindUnique.mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ leadId: "missing" }), routeContext());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Lead not found");
  });

  it("returns 400 when lead has no email", async () => {
    mockGetById.mockResolvedValueOnce({ id: "tpl-1", isActive: true });
    mockLeadFindUnique.mockResolvedValueOnce({
      id: "lead-1",
      firstName: "Jane",
      lastName: "Smith",
      email: null,
    });

    const res = await POST(makeRequest({ leadId: "lead-1" }), routeContext());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Lead has no email address");
  });

  it("returns 400 when PostmarkService returns error", async () => {
    mockGetById.mockResolvedValueOnce({
      id: "tpl-1",
      name: "Test",
      subject: "Hi",
      htmlBody: "<p>Hi</p>",
      fromEmail: "a@b.com",
      fromName: "Sender",
      isActive: true,
    });
    mockLeadFindUnique.mockResolvedValueOnce({
      id: "lead-1",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: null,
    });
    mockRenderTemplate.mockReturnValueOnce({
      subject: "Hi",
      htmlBody: "<p>Hi</p>",
      textBody: null,
    });
    mockPostmarkSendEmail.mockResolvedValueOnce({ error: "Invalid token" });

    const res = await POST(makeRequest({ leadId: "lead-1" }), routeContext());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid token");
  });

  it("passes custom variables to renderTemplate", async () => {
    mockGetById.mockResolvedValueOnce({
      id: "tpl-1",
      name: "Test",
      subject: "{{companyName}}",
      htmlBody: "",
      fromEmail: "a@b.com",
      fromName: "Sender",
      isActive: true,
    });
    mockLeadFindUnique.mockResolvedValueOnce({
      id: "lead-1",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: null,
    });
    mockRenderTemplate.mockReturnValueOnce({
      subject: "Acme Corp",
      htmlBody: "",
      textBody: null,
    });
    mockPostmarkSendEmail.mockResolvedValueOnce({ providerRef: "msg-456" });

    await POST(
      makeRequest({ leadId: "lead-1", variables: { companyName: "Acme Corp" } }),
      routeContext()
    );

    expect(mockRenderTemplate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ companyName: "Acme Corp" })
    );
  });
});
