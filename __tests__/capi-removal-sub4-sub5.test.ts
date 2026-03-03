import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock prisma ----
const mockConversionFindFirst = vi.fn();
const mockConversionCreate = vi.fn();
const mockContactAttemptFindUnique = vi.fn();
const mockLeadFindFirst = vi.fn();
const mockLeadFindUnique = vi.fn();
const mockLeadUpdate = vi.fn();
const mockKeitaroCampaignMappingFindUnique = vi.fn();
const mockPostbackLogCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    conversion: {
      findFirst: (...args: unknown[]) => mockConversionFindFirst(...args),
      create: (...args: unknown[]) => mockConversionCreate(...args),
    },
    contactAttempt: {
      findUnique: (...args: unknown[]) => mockContactAttemptFindUnique(...args),
    },
    lead: {
      findFirst: (...args: unknown[]) => mockLeadFindFirst(...args),
      findUnique: (...args: unknown[]) => mockLeadFindUnique(...args),
      update: (...args: unknown[]) => mockLeadUpdate(...args),
    },
    keitaroCampaignMapping: {
      findUnique: (...args: unknown[]) => mockKeitaroCampaignMappingFindUnique(...args),
    },
    postbackLog: {
      create: (...args: unknown[]) => mockPostbackLogCreate(...args),
    },
  },
}));

// Mock ABTestService
vi.mock("@/services/ab-test.service", () => ({
  ABTestService: {
    recordOutcome: vi.fn(),
    autoEndTest: vi.fn(),
  },
}));

// Mock RetentionSequenceService
vi.mock("@/services/retention-sequence.service", () => ({
  RetentionSequenceService: {
    markConverted: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock LeadScoringService
vi.mock("@/services/lead-scoring.service", () => ({
  LeadScoringService: {
    calculateScore: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock OutboundPostbackService
const mockSendConversionPostback = vi.fn().mockResolvedValue(undefined);
vi.mock("@/services/outbound-postback.service", () => ({
  OutboundPostbackService: {
    sendConversionPostback: (...args: unknown[]) => mockSendConversionPostback(...args),
  },
}));

// Mock MetaCapiService — should NOT be called
const mockSendConversionEvent = vi.fn();
const mockSendLeadEvent = vi.fn();
vi.mock("@/services/meta-capi.service", () => ({
  MetaCapiService: {
    sendConversionEvent: (...args: unknown[]) => mockSendConversionEvent(...args),
    sendLeadEvent: (...args: unknown[]) => mockSendLeadEvent(...args),
  },
}));

import { GET, POST } from "@/app/api/webhooks/keitaro/route";
import { NextRequest } from "next/server";

// ---- Helpers ----
function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/webhooks/keitaro");
  url.searchParams.set("secret", "test-secret");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  const url = new URL("http://localhost/api/webhooks/keitaro?secret=test-secret");
  return new NextRequest(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_LEAD = {
  id: "lead-1",
  email: "test@example.com",
  phone: "+1234567890",
  firstName: "John",
  lastName: "Doe",
  externalId: "sub-123",
  source: "META",
  status: "NEW",
  campaignId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_CONVERSION = {
  id: "conv-1",
  leadId: "lead-1",
  campaignId: null,
  channel: "email",
  revenue: 50,
  status: "sale",
  subId: "sub-123",
  clickId: null,
  source: "keitaro",
  postbackData: "{}",
  contactAttemptId: null,
  keitaroCampaignId: null,
  keitaroCampaignName: null,
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.KEITARO_WEBHOOK_SECRET = "test-secret";
  // Default: no duplicate
  mockConversionFindFirst.mockResolvedValue(null);
  // Default: no contact attempt match
  mockContactAttemptFindUnique.mockResolvedValue(null);
  // Default: no lead match
  mockLeadFindFirst.mockResolvedValue(null);
  mockLeadFindUnique.mockResolvedValue(null);
  // Default: no campaign mapping
  mockKeitaroCampaignMappingFindUnique.mockResolvedValue(null);
  // Default: conversion create returns mock
  mockConversionCreate.mockResolvedValue(MOCK_CONVERSION);
  // Suppress console output in tests
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  // Mock global fetch for Hermes webhook
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("") }));
});

describe("Keitaro webhook — CAPI removal", () => {
  it("does NOT call MetaCapiService.sendConversionEvent on sale conversion", async () => {
    // Lead found
    mockLeadFindFirst.mockResolvedValue({ id: "lead-1" });
    mockLeadFindUnique.mockResolvedValue(MOCK_LEAD);
    mockLeadUpdate.mockResolvedValue(MOCK_LEAD);

    const req = makeGetRequest({ sub_id: "sub-123", status: "sale", payout: "50" });
    const res = await GET(req);
    const data = await res.json();

    expect(data.received).toBe(true);
    expect(mockSendConversionEvent).not.toHaveBeenCalled();
  });

  it("does NOT call MetaCapiService.sendLeadEvent on lead conversion", async () => {
    // Lead found with source=META
    mockLeadFindFirst.mockResolvedValue({ id: "lead-1" });
    mockLeadFindUnique.mockResolvedValue({ ...MOCK_LEAD, source: "META" });

    const req = makePostRequest({ sub_id: "sub-123", status: "lead" });
    const res = await POST(req);
    const data = await res.json();

    expect(data.received).toBe(true);
    expect(mockSendLeadEvent).not.toHaveBeenCalled();
  });

  it("does NOT import or reference MetaCapiService in keitaro route source", async () => {
    // This is a static analysis test — we read the source file and verify no MetaCapi references
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../src/app/api/webhooks/keitaro/route.ts", import.meta.url).pathname,
      "utf-8"
    );
    expect(source).not.toContain("MetaCapiService");
    expect(source).not.toContain("meta-capi.service");
  });
});

describe("Outbound postback — sub4/sub5 parameters", () => {
  it("TC postback URL includes sub4 parameter with retention_{channel} format", async () => {
    // Use the actual OutboundPostbackService to verify sub4/sub5
    // We need to re-import the real service (unmock it for this describe block)
    vi.doUnmock("@/services/outbound-postback.service");
    const { OutboundPostbackService } = await import("@/services/outbound-postback.service");

    // Mock fetch to capture URLs
    const fetchCalls: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, text: () => Promise.resolve("OK"), status: 200 });
    }));

    // Mock postbackLog.create
    mockPostbackLogCreate.mockResolvedValue({});

    const lead = { ...MOCK_LEAD, externalId: "sub-xyz" } as any;
    const conversion = { ...MOCK_CONVERSION, channel: "email" } as any;

    await OutboundPostbackService.sendConversionPostback(lead, conversion);

    // Find the TC postback URL
    const tcUrl = fetchCalls.find((u) => u.includes("postback") && u.includes("subid"));
    expect(tcUrl).toBeDefined();

    const parsed = new URL(tcUrl!);
    expect(parsed.searchParams.get("sub4")).toBe("retention_email");
  });

  it("TC postback URL includes sub5 parameter with lead id", async () => {
    vi.doUnmock("@/services/outbound-postback.service");
    const { OutboundPostbackService } = await import("@/services/outbound-postback.service");

    const fetchCalls: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, text: () => Promise.resolve("OK"), status: 200 });
    }));

    mockPostbackLogCreate.mockResolvedValue({});

    const lead = { ...MOCK_LEAD, id: "lead-abc", externalId: "sub-xyz" } as any;
    const conversion = { ...MOCK_CONVERSION, channel: "sms" } as any;

    await OutboundPostbackService.sendConversionPostback(lead, conversion);

    const tcUrl = fetchCalls.find((u) => u.includes("postback") && u.includes("subid"));
    expect(tcUrl).toBeDefined();

    const parsed = new URL(tcUrl!);
    expect(parsed.searchParams.get("sub5")).toBe("lead-abc");
  });

  it("sub4 format is retention_email for email channel", async () => {
    vi.doUnmock("@/services/outbound-postback.service");
    const { OutboundPostbackService } = await import("@/services/outbound-postback.service");

    const fetchCalls: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, text: () => Promise.resolve("OK"), status: 200 });
    }));
    mockPostbackLogCreate.mockResolvedValue({});

    const lead = { ...MOCK_LEAD, externalId: "sub-1" } as any;
    const conversion = { ...MOCK_CONVERSION, channel: "email" } as any;

    await OutboundPostbackService.sendConversionPostback(lead, conversion);

    const tcUrl = fetchCalls.find((u) => u.includes("postback") && u.includes("subid"));
    const parsed = new URL(tcUrl!);
    expect(parsed.searchParams.get("sub4")).toBe("retention_email");
  });

  it("sub4 format is retention_sms for sms channel", async () => {
    vi.doUnmock("@/services/outbound-postback.service");
    const { OutboundPostbackService } = await import("@/services/outbound-postback.service");

    const fetchCalls: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, text: () => Promise.resolve("OK"), status: 200 });
    }));
    mockPostbackLogCreate.mockResolvedValue({});

    const lead = { ...MOCK_LEAD, externalId: "sub-1" } as any;
    const conversion = { ...MOCK_CONVERSION, channel: "sms" } as any;

    await OutboundPostbackService.sendConversionPostback(lead, conversion);

    const tcUrl = fetchCalls.find((u) => u.includes("postback") && u.includes("subid"));
    const parsed = new URL(tcUrl!);
    expect(parsed.searchParams.get("sub4")).toBe("retention_sms");
  });

  it("sub4 format is retention_call for call channel", async () => {
    vi.doUnmock("@/services/outbound-postback.service");
    const { OutboundPostbackService } = await import("@/services/outbound-postback.service");

    const fetchCalls: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, text: () => Promise.resolve("OK"), status: 200 });
    }));
    mockPostbackLogCreate.mockResolvedValue({});

    const lead = { ...MOCK_LEAD, externalId: "sub-1" } as any;
    const conversion = { ...MOCK_CONVERSION, channel: "call" } as any;

    await OutboundPostbackService.sendConversionPostback(lead, conversion);

    const tcUrl = fetchCalls.find((u) => u.includes("postback") && u.includes("subid"));
    const parsed = new URL(tcUrl!);
    expect(parsed.searchParams.get("sub4")).toBe("retention_call");
  });

  it("sub4 defaults to retention_unknown when channel is null", async () => {
    vi.doUnmock("@/services/outbound-postback.service");
    const { OutboundPostbackService } = await import("@/services/outbound-postback.service");

    const fetchCalls: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, text: () => Promise.resolve("OK"), status: 200 });
    }));
    mockPostbackLogCreate.mockResolvedValue({});

    const lead = { ...MOCK_LEAD, externalId: "sub-1" } as any;
    const conversion = { ...MOCK_CONVERSION, channel: null } as any;

    await OutboundPostbackService.sendConversionPostback(lead, conversion);

    const tcUrl = fetchCalls.find((u) => u.includes("postback") && u.includes("subid"));
    const parsed = new URL(tcUrl!);
    expect(parsed.searchParams.get("sub4")).toBe("retention_unknown");
  });
});
