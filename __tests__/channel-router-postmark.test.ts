import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----
const mockPostmarkSendEmail = vi.fn();
const mockInstantlySendEmail = vi.fn();

vi.mock("@/services/channel/postmark.service", () => ({
  PostmarkService: {
    sendEmail: (...args: unknown[]) => mockPostmarkSendEmail(...args),
  },
}));

vi.mock("@/services/channel/email.service", () => ({
  InstantlyService: {
    sendEmail: (...args: unknown[]) => mockInstantlySendEmail(...args),
  },
}));

vi.mock("@/services/channel/vapi.service", () => ({
  VapiService: { createCall: vi.fn().mockResolvedValue({ providerRef: "call-1" }) },
}));

vi.mock("@/services/channel/sms.service", () => ({
  SmsService: { sendSms: vi.fn().mockResolvedValue({ providerRef: "sms-1" }) },
}));

vi.mock("@/services/ab-test.service", () => ({
  ABTestService: {
    getActiveTest: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@/services/scheduler.service", () => ({
  SchedulerService: {
    isWithinSchedule: vi.fn().mockResolvedValue(true),
    canContactLead: vi.fn().mockResolvedValue(true),
    getNextAvailableSlot: vi.fn(),
    scheduleContact: vi.fn(),
  },
}));

// Prisma mock
const mockPrismaFindUnique = vi.fn();
const mockPrismaFindFirst = vi.fn();
const mockPrismaCount = vi.fn();
const mockPrismaCreate = vi.fn();
const mockPrismaUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    integrationConfig: {
      findUnique: (...args: unknown[]) => mockPrismaFindUnique(...args),
    },
    contactAttempt: {
      count: (...args: unknown[]) => mockPrismaCount(...args),
      create: (...args: unknown[]) => mockPrismaCreate(...args),
      update: (...args: unknown[]) => mockPrismaUpdate(...args),
    },
    script: {
      findFirst: (...args: unknown[]) => mockPrismaFindFirst(...args),
      findUnique: vi.fn(),
    },
  },
}));

import { ChannelRouterService } from "@/services/channel/channel-router.service";

function fakeLead() {
  return {
    id: "lead-1",
    externalId: null,
    firstName: "Jane",
    lastName: "Smith",
    phone: "+1234567890",
    email: "jane@example.com",
    source: "web",
    status: "NEW",
    meta: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function fakeCampaign() {
  return {
    id: "camp-1",
    name: "Test Campaign",
    status: "ACTIVE",
    channels: JSON.stringify(["EMAIL"]),
    meta: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("ChannelRouterService - Postmark routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: contact count under limit
    mockPrismaCount.mockResolvedValue(0);
    // Default: script found
    mockPrismaFindFirst.mockResolvedValue({
      id: "script-1",
      name: "Test Script",
      content: "<p>Hello {{firstName}}</p>",
      type: "EMAIL",
      campaignId: null,
      isDefault: true,
    });
    // Default: attempt created
    mockPrismaCreate.mockResolvedValue({ id: "att-1" });
    mockPrismaUpdate.mockResolvedValue({});
  });

  it("routes EMAIL through Postmark when postmark is active", async () => {
    mockPrismaFindUnique.mockResolvedValueOnce({
      provider: "postmark",
      isActive: true,
      config: JSON.stringify({ serverToken: "tok" }),
    });
    mockPostmarkSendEmail.mockResolvedValueOnce({ providerRef: "pm-msg-1" });

    const result = await ChannelRouterService.routeContact(
      fakeLead() as Parameters<typeof ChannelRouterService.routeContact>[0],
      fakeCampaign() as Parameters<typeof ChannelRouterService.routeContact>[1],
      "EMAIL"
    );

    expect(mockPostmarkSendEmail).toHaveBeenCalled();
    expect(mockInstantlySendEmail).not.toHaveBeenCalled();
    expect(result).toHaveProperty("attemptId");
  });

  it("falls back to Instantly when postmark is inactive", async () => {
    mockPrismaFindUnique.mockResolvedValueOnce({
      provider: "postmark",
      isActive: false,
    });
    mockInstantlySendEmail.mockResolvedValueOnce({ providerRef: "inst-1" });

    const result = await ChannelRouterService.routeContact(
      fakeLead() as Parameters<typeof ChannelRouterService.routeContact>[0],
      fakeCampaign() as Parameters<typeof ChannelRouterService.routeContact>[1],
      "EMAIL"
    );

    expect(mockInstantlySendEmail).toHaveBeenCalled();
    expect(mockPostmarkSendEmail).not.toHaveBeenCalled();
    expect(result).toHaveProperty("attemptId");
  });

  it("falls back to Instantly when postmark config not found", async () => {
    mockPrismaFindUnique.mockResolvedValueOnce(null);
    mockInstantlySendEmail.mockResolvedValueOnce({ providerRef: "inst-2" });

    const result = await ChannelRouterService.routeContact(
      fakeLead() as Parameters<typeof ChannelRouterService.routeContact>[0],
      fakeCampaign() as Parameters<typeof ChannelRouterService.routeContact>[1],
      "EMAIL"
    );

    expect(mockInstantlySendEmail).toHaveBeenCalled();
    expect(result).toHaveProperty("attemptId");
  });

  it("updates provider to postmark on the attempt record when postmark sends", async () => {
    mockPrismaFindUnique.mockResolvedValueOnce({
      provider: "postmark",
      isActive: true,
      config: JSON.stringify({ serverToken: "tok" }),
    });
    mockPostmarkSendEmail.mockResolvedValueOnce({ providerRef: "pm-msg-2" });

    await ChannelRouterService.routeContact(
      fakeLead() as Parameters<typeof ChannelRouterService.routeContact>[0],
      fakeCampaign() as Parameters<typeof ChannelRouterService.routeContact>[1],
      "EMAIL"
    );

    // Should update provider to "postmark" on the attempt
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "att-1" },
        data: expect.objectContaining({ provider: "postmark" }),
      })
    );
  });

  it("returns error when postmark send fails", async () => {
    mockPrismaFindUnique.mockResolvedValueOnce({
      provider: "postmark",
      isActive: true,
    });
    mockPostmarkSendEmail.mockResolvedValueOnce({ error: "Invalid sender" });

    const result = await ChannelRouterService.routeContact(
      fakeLead() as Parameters<typeof ChannelRouterService.routeContact>[0],
      fakeCampaign() as Parameters<typeof ChannelRouterService.routeContact>[1],
      "EMAIL"
    );

    expect(result).toEqual({ error: "Invalid sender" });
  });
});
