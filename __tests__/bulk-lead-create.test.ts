import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock prisma ----
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { LeadService } from "@/services/lead.service";
import type { LeadCreateInput } from "@/types";

function makeLead(overrides: Partial<LeadCreateInput> & { id?: string }) {
  return {
    id: overrides.id || `lead-${Math.random().toString(36).slice(2, 8)}`,
    firstName: overrides.firstName || "John",
    lastName: overrides.lastName || "Doe",
    email: overrides.email || null,
    phone: overrides.phone || null,
    source: overrides.source || "MANUAL",
    externalId: null,
    meta: null,
    notes: null,
    webhookId: overrides.webhookId || null,
    status: "NEW",
    score: null,
    scoreLabel: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("LeadService.bulkCreateOptimized", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockTransaction.mockReset();
  });

  it("creates all leads when no duplicates exist", async () => {
    mockFindMany.mockResolvedValue([]);
    const created1 = makeLead({ id: "new-1", email: "a@test.com" });
    const created2 = makeLead({ id: "new-2", email: "b@test.com" });
    mockTransaction.mockResolvedValue([created1, created2]);

    const inputs: LeadCreateInput[] = [
      { firstName: "A", lastName: "One", email: "a@test.com" },
      { firstName: "B", lastName: "Two", email: "b@test.com" },
    ];

    const { results, createdLeadIds } = await LeadService.bulkCreateOptimized(inputs);

    expect(results.created).toBe(2);
    expect(results.deduplicated).toBe(0);
    expect(results.errors).toBe(0);
    expect(createdLeadIds).toEqual(["new-1", "new-2"]);
    expect(mockFindMany).toHaveBeenCalledOnce();
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("deduplicates leads by email", async () => {
    const existing = makeLead({ id: "existing-1", email: "dup@test.com" });
    mockFindMany.mockResolvedValue([existing]);
    const created1 = makeLead({ id: "new-1", email: "fresh@test.com" });
    mockTransaction.mockResolvedValue([created1]);

    const inputs: LeadCreateInput[] = [
      { firstName: "Dup", lastName: "Lead", email: "dup@test.com" },
      { firstName: "New", lastName: "Lead", email: "fresh@test.com" },
    ];

    const { results, createdLeadIds } = await LeadService.bulkCreateOptimized(inputs);

    expect(results.created).toBe(1);
    expect(results.deduplicated).toBe(1);
    expect(createdLeadIds).toEqual(["new-1"]);
  });

  it("deduplicates leads by phone", async () => {
    const existing = makeLead({ id: "existing-1", phone: "+1234567890" });
    mockFindMany.mockResolvedValue([existing]);
    mockTransaction.mockResolvedValue([]);

    const inputs: LeadCreateInput[] = [
      { firstName: "Dup", lastName: "Lead", phone: "+1234567890" },
    ];

    const { results } = await LeadService.bulkCreateOptimized(inputs);

    expect(results.created).toBe(0);
    expect(results.deduplicated).toBe(1);
  });

  it("updates webhookId for deduped leads when missing", async () => {
    const existing = makeLead({ id: "existing-1", email: "dup@test.com", webhookId: undefined });
    existing.webhookId = null;
    mockFindMany.mockResolvedValue([existing]);
    // First transaction call = creates (none), second = webhook updates
    mockTransaction
      .mockResolvedValueOnce([]) // no new leads to create (empty newLeadData)
      .mockResolvedValueOnce([{}]); // webhook update

    const inputs: LeadCreateInput[] = [
      { firstName: "Dup", lastName: "Lead", email: "dup@test.com", webhookId: "wh-123" },
    ];

    const { results } = await LeadService.bulkCreateOptimized(inputs);

    expect(results.deduplicated).toBe(1);
    expect(results.created).toBe(0);
    // Should have been called for webhook updates (second $transaction)
    expect(mockTransaction).toHaveBeenCalledTimes(1); // only webhook update, no creates
  });

  it("skips webhookId update if existing lead already has one", async () => {
    const existing = makeLead({ id: "existing-1", email: "dup@test.com", webhookId: "wh-old" });
    mockFindMany.mockResolvedValue([existing]);

    const inputs: LeadCreateInput[] = [
      { firstName: "Dup", lastName: "Lead", email: "dup@test.com", webhookId: "wh-new" },
    ];

    const { results } = await LeadService.bulkCreateOptimized(inputs);

    expect(results.deduplicated).toBe(1);
    // No $transaction called at all (no creates, no webhook updates)
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns empty results for empty input", async () => {
    const { results, createdLeadIds } = await LeadService.bulkCreateOptimized([]);

    expect(results).toEqual({ created: 0, deduplicated: 0, errors: 0 });
    expect(createdLeadIds).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("handles mixed email+phone dedup correctly", async () => {
    // Lead with email match but different phone — should still dedup by email
    const existing = makeLead({ id: "existing-1", email: "match@test.com", phone: "+111" });
    mockFindMany.mockResolvedValue([existing]);
    mockTransaction.mockResolvedValue([]);

    const inputs: LeadCreateInput[] = [
      { firstName: "Test", lastName: "Lead", email: "match@test.com", phone: "+999" },
    ];

    const { results } = await LeadService.bulkCreateOptimized(inputs);

    expect(results.deduplicated).toBe(1);
    expect(results.created).toBe(0);
  });

  it("handles leads with no email and no phone as new", async () => {
    // No email/phone — no dedup possible, should create
    const created1 = makeLead({ id: "new-1" });
    // prisma.lead.create is called first, its result goes into the array for $transaction
    mockCreate.mockResolvedValue(created1);
    // $transaction receives array of promises from create calls, resolves them
    mockTransaction.mockResolvedValue([created1]);

    const inputs: LeadCreateInput[] = [
      { firstName: "No", lastName: "Contact" },
    ];

    const { results, createdLeadIds } = await LeadService.bulkCreateOptimized(inputs);

    expect(results.created).toBe(1);
    expect(results.deduplicated).toBe(0);
    expect(createdLeadIds).toEqual(["new-1"]);
    // orConditions would be empty so findMany is skipped
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
