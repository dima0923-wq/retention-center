import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const SAMPLE_VARIABLES: Record<string, string> = {
  firstName: "John",
  lastName: "Doe",
  phone: "+1 555-0123",
  email: "john.doe@example.com",
  companyName: "Acme Corp",
  unsubscribeUrl: "https://example.com/unsubscribe",
};

function parseJsonFields<T extends { variables: string; metadata: string }>(
  template: T
): T & { variables: string[]; metadata: Record<string, unknown> } {
  let variables: string[] = [];
  let metadata: Record<string, unknown> = {};
  try {
    variables = JSON.parse(template.variables);
  } catch {}
  try {
    metadata = JSON.parse(template.metadata);
  } catch {}
  return { ...template, variables, metadata };
}

export class EmailTemplateService {
  static async create(data: {
    name: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    fromEmail?: string;
    fromName?: string;
    trigger?: string;
    isActive?: boolean;
    isDefault?: boolean;
    variables?: string[];
    metadata?: Record<string, unknown>;
  }) {
    const template = await prisma.emailTemplate.create({
      data: {
        name: data.name,
        subject: data.subject,
        htmlBody: data.htmlBody,
        textBody: data.textBody ?? null,
        fromEmail: data.fromEmail ?? "noreply@example.com",
        fromName: data.fromName ?? "Retention Center",
        trigger: data.trigger ?? "manual",
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
        variables: JSON.stringify(data.variables ?? []),
        metadata: JSON.stringify(data.metadata ?? {}),
      },
    });
    return parseJsonFields(template);
  }

  static async list(filters?: {
    trigger?: string;
    isActive?: boolean;
    search?: string;
  }) {
    const where: Prisma.EmailTemplateWhereInput = {};
    if (filters?.trigger) where.trigger = filters.trigger;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) {
      where.name = { contains: filters.search };
    }

    const templates = await prisma.emailTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return templates.map(parseJsonFields);
  }

  static async getById(id: string) {
    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });
    if (!template) return null;
    return parseJsonFields(template);
  }

  static async update(
    id: string,
    data: {
      name?: string;
      subject?: string;
      htmlBody?: string;
      textBody?: string | null;
      fromEmail?: string;
      fromName?: string;
      trigger?: string;
      isActive?: boolean;
      isDefault?: boolean;
      variables?: string[];
      metadata?: Record<string, unknown>;
    }
  ) {
    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.htmlBody !== undefined && { htmlBody: data.htmlBody }),
        ...(data.textBody !== undefined && { textBody: data.textBody }),
        ...(data.fromEmail !== undefined && { fromEmail: data.fromEmail }),
        ...(data.fromName !== undefined && { fromName: data.fromName }),
        ...(data.trigger !== undefined && { trigger: data.trigger }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.variables !== undefined && { variables: JSON.stringify(data.variables) }),
        ...(data.metadata !== undefined && { metadata: JSON.stringify(data.metadata) }),
      },
    });
    return parseJsonFields(template);
  }

  static async delete(id: string) {
    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new Error("Email template not found");
    if (template.isDefault && template.isActive) {
      throw new Error("Cannot delete an active default template");
    }
    await prisma.emailTemplate.delete({ where: { id } });
    return template;
  }

  static async duplicate(id: string) {
    const template = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) return null;

    const copy = await prisma.emailTemplate.create({
      data: {
        name: `${template.name} (Copy)`,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
        fromEmail: template.fromEmail,
        fromName: template.fromName,
        trigger: template.trigger,
        isActive: false,
        isDefault: false,
        variables: template.variables,
        metadata: template.metadata,
      },
    });
    return parseJsonFields(copy);
  }

  static async getByTrigger(trigger: string) {
    const templates = await prisma.emailTemplate.findMany({
      where: { trigger, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return templates.map(parseJsonFields);
  }

  static async getDefault() {
    const template = await prisma.emailTemplate.findFirst({
      where: { isDefault: true, isActive: true },
    });
    if (!template) return null;
    return parseJsonFields(template);
  }

  static renderTemplate(
    template: { subject: string; htmlBody: string; textBody?: string | null },
    variables?: Record<string, string>
  ): { subject: string; htmlBody: string; textBody: string | null } {
    const vars = { ...SAMPLE_VARIABLES, ...variables };
    const replace = (text: string) =>
      text.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);

    return {
      subject: replace(template.subject),
      htmlBody: replace(template.htmlBody),
      textBody: template.textBody ? replace(template.textBody) : null,
    };
  }

  static getSampleVariables() {
    return SAMPLE_VARIABLES;
  }
}
