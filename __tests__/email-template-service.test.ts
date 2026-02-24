import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock prisma ----
const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdateFn = vi.fn();
const mockDeleteFn = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    emailTemplate: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdateFn(...args),
      delete: (...args: unknown[]) => mockDeleteFn(...args),
    },
  },
}));

import { EmailTemplateService } from "@/services/email-template.service";

describe("EmailTemplateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("renderTemplate", () => {
    it("replaces variables with provided values", () => {
      const result = EmailTemplateService.renderTemplate(
        {
          subject: "Hello {{firstName}}",
          htmlBody: "<p>Dear {{firstName}} {{lastName}}</p>",
          textBody: "Phone: {{phone}}, Email: {{email}}",
        },
        { firstName: "Alice", lastName: "Wonder", phone: "+1999", email: "a@b.com" }
      );

      expect(result.subject).toBe("Hello Alice");
      expect(result.htmlBody).toBe("<p>Dear Alice Wonder</p>");
      expect(result.textBody).toBe("Phone: +1999, Email: a@b.com");
    });

    it("uses sample variables as defaults", () => {
      const result = EmailTemplateService.renderTemplate({
        subject: "Hi {{firstName}}",
        htmlBody: "<p>{{email}}</p>",
      });

      expect(result.subject).toBe("Hi John");
      expect(result.htmlBody).toBe("<p>john.doe@example.com</p>");
    });

    it("keeps unknown variables as-is", () => {
      const result = EmailTemplateService.renderTemplate({
        subject: "{{unknownVar}}",
        htmlBody: "<p>{{anotherUnknown}}</p>",
      });

      expect(result.subject).toBe("{{unknownVar}}");
      expect(result.htmlBody).toBe("<p>{{anotherUnknown}}</p>");
    });

    it("returns null textBody when input has no textBody", () => {
      const result = EmailTemplateService.renderTemplate({
        subject: "Hi",
        htmlBody: "<p>Hi</p>",
        textBody: null,
      });
      expect(result.textBody).toBeNull();
    });

    it("overrides sample variables with provided values", () => {
      const result = EmailTemplateService.renderTemplate(
        { subject: "Hi {{firstName}}", htmlBody: "" },
        { firstName: "Custom" }
      );
      expect(result.subject).toBe("Hi Custom");
    });
  });

  describe("getSampleVariables", () => {
    it("returns expected sample variable keys", () => {
      const vars = EmailTemplateService.getSampleVariables();
      expect(vars).toHaveProperty("firstName");
      expect(vars).toHaveProperty("lastName");
      expect(vars).toHaveProperty("phone");
      expect(vars).toHaveProperty("email");
      expect(vars).toHaveProperty("companyName");
      expect(vars).toHaveProperty("unsubscribeUrl");
    });
  });

  describe("create", () => {
    it("calls prisma.create with correct data", async () => {
      const template = {
        id: "t1",
        name: "Welcome",
        subject: "Welcome {{firstName}}",
        htmlBody: "<p>Hello</p>",
        textBody: null,
        fromEmail: "noreply@example.com",
        fromName: "Retention Center",
        trigger: "manual",
        isActive: true,
        isDefault: false,
        variables: "[]",
        metadata: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockCreate.mockResolvedValueOnce(template);

      const result = await EmailTemplateService.create({
        name: "Welcome",
        subject: "Welcome {{firstName}}",
        htmlBody: "<p>Hello</p>",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Welcome",
            subject: "Welcome {{firstName}}",
            htmlBody: "<p>Hello</p>",
          }),
        })
      );
      expect(result.name).toBe("Welcome");
    });
  });

  describe("delete", () => {
    it("throws when template not found", async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      await expect(EmailTemplateService.delete("xxx")).rejects.toThrow(
        "Email template not found"
      );
    });

    it("throws when deleting active default template", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "t1",
        isDefault: true,
        isActive: true,
      });
      await expect(EmailTemplateService.delete("t1")).rejects.toThrow(
        "Cannot delete an active default template"
      );
    });

    it("allows deleting inactive default template", async () => {
      const template = { id: "t2", isDefault: true, isActive: false };
      mockFindUnique.mockResolvedValueOnce(template);
      mockDeleteFn.mockResolvedValueOnce(template);

      const result = await EmailTemplateService.delete("t2");
      expect(mockDeleteFn).toHaveBeenCalledWith({ where: { id: "t2" } });
      expect(result.id).toBe("t2");
    });
  });

  describe("duplicate", () => {
    it("returns null when template not found", async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      const result = await EmailTemplateService.duplicate("missing");
      expect(result).toBeNull();
    });

    it("creates a copy with (Copy) suffix and inactive", async () => {
      const original = {
        id: "t1",
        name: "Welcome",
        subject: "Hi",
        htmlBody: "<p>Hi</p>",
        textBody: null,
        fromEmail: "a@b.com",
        fromName: "Sender",
        trigger: "manual",
        isActive: true,
        isDefault: true,
        variables: "[]",
        metadata: "{}",
      };
      mockFindUnique.mockResolvedValueOnce(original);
      mockCreate.mockResolvedValueOnce({
        ...original,
        id: "t2",
        name: "Welcome (Copy)",
        isActive: false,
        isDefault: false,
      });

      const result = await EmailTemplateService.duplicate("t1");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Welcome (Copy)",
            isActive: false,
            isDefault: false,
          }),
        })
      );
      expect(result!.name).toBe("Welcome (Copy)");
    });
  });
});
