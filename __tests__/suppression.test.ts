import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock prisma ----
const mockSuppressedFindUnique = vi.fn();
const mockSuppressedUpsert = vi.fn();
const mockSuppressedDelete = vi.fn();
const mockSuppressedFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    suppressedEmail: {
      findUnique: (...args: unknown[]) => mockSuppressedFindUnique(...args),
      upsert: (...args: unknown[]) => mockSuppressedUpsert(...args),
      delete: (...args: unknown[]) => mockSuppressedDelete(...args),
      findMany: (...args: unknown[]) => mockSuppressedFindMany(...args),
    },
  },
}));

import { isEmailSuppressed, suppressEmail, unsuppressEmail, listSuppressedEmails } from "@/lib/suppression";

describe("Suppression Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isEmailSuppressed", () => {
    it("returns false when email is not in suppression list", async () => {
      mockSuppressedFindUnique.mockResolvedValueOnce(null);
      const result = await isEmailSuppressed("good@example.com");
      expect(result).toBe(false);
    });

    it("returns true when email is in suppression list", async () => {
      mockSuppressedFindUnique.mockResolvedValueOnce({
        id: "sup-1",
        email: "bad@example.com",
        reason: "hard_bounce",
      });
      const result = await isEmailSuppressed("bad@example.com");
      expect(result).toBe(true);
    });

    it("normalizes email to lowercase", async () => {
      mockSuppressedFindUnique.mockResolvedValueOnce(null);
      await isEmailSuppressed("User@Example.COM");
      expect(mockSuppressedFindUnique).toHaveBeenCalledWith({
        where: { email: "user@example.com" },
      });
    });
  });

  describe("suppressEmail", () => {
    it("upserts email to suppression list", async () => {
      mockSuppressedUpsert.mockResolvedValueOnce({});
      await suppressEmail("bad@example.com", "hard_bounce", "webhook");
      expect(mockSuppressedUpsert).toHaveBeenCalledWith({
        where: { email: "bad@example.com" },
        create: { email: "bad@example.com", reason: "hard_bounce", source: "webhook" },
        update: expect.objectContaining({ reason: "hard_bounce", source: "webhook" }),
      });
    });

    it("normalizes email to lowercase", async () => {
      mockSuppressedUpsert.mockResolvedValueOnce({});
      await suppressEmail("BAD@EXAMPLE.COM", "spam_complaint");
      expect(mockSuppressedUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: "bad@example.com" },
        })
      );
    });
  });

  describe("unsuppressEmail", () => {
    it("removes email from suppression list", async () => {
      mockSuppressedDelete.mockResolvedValueOnce({});
      const result = await unsuppressEmail("good@example.com");
      expect(result).toBe(true);
    });

    it("returns false if email not found", async () => {
      mockSuppressedDelete.mockRejectedValueOnce(new Error("Not found"));
      const result = await unsuppressEmail("missing@example.com");
      expect(result).toBe(false);
    });
  });

  describe("listSuppressedEmails", () => {
    it("returns suppressed emails list", async () => {
      mockSuppressedFindMany.mockResolvedValueOnce([
        { id: "sup-1", email: "a@test.com", reason: "hard_bounce" },
      ]);
      const result = await listSuppressedEmails();
      expect(result).toHaveLength(1);
    });

    it("filters by reason", async () => {
      mockSuppressedFindMany.mockResolvedValueOnce([]);
      await listSuppressedEmails({ reason: "spam_complaint" });
      expect(mockSuppressedFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { reason: "spam_complaint" },
        })
      );
    });
  });
});
