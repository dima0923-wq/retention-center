import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const TEMPLATE_VARIABLES: Record<string, string> = {
  firstName: "John",
  lastName: "Doe",
  phone: "+1 555-0123",
  email: "john.doe@example.com",
  companyName: "Acme Corp",
};

function parseVapiConfig<T extends { vapiConfig: string | null }>(
  script: T
): T & { vapiConfig: Record<string, unknown> | null } {
  if (!script.vapiConfig) return { ...script, vapiConfig: null };
  try {
    return { ...script, vapiConfig: JSON.parse(script.vapiConfig) };
  } catch {
    return { ...script, vapiConfig: null };
  }
}

export class ScriptService {
  static async create(data: {
    name: string;
    type: "CALL" | "SMS" | "EMAIL";
    content?: string;
    vapiConfig?: Record<string, unknown>;
    campaignId?: string;
    isDefault?: boolean;
  }) {
    const script = await prisma.script.create({
      data: {
        name: data.name,
        type: data.type,
        content: data.content ?? null,
        vapiConfig: data.vapiConfig ? JSON.stringify(data.vapiConfig) : null,
        campaignId: data.campaignId ?? null,
        isDefault: data.isDefault ?? false,
      },
    });
    return parseVapiConfig(script);
  }

  static async list(filters?: {
    type?: "CALL" | "SMS" | "EMAIL";
    campaignId?: string;
    search?: string;
  }) {
    const where: Prisma.ScriptWhereInput = {};
    if (filters?.type) where.type = filters.type;
    if (filters?.campaignId) where.campaignId = filters.campaignId;
    if (filters?.search) {
      where.name = { contains: filters.search };
    }

    const scripts = await prisma.script.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { campaign: true },
    });
    return scripts.map(parseVapiConfig);
  }

  static async getById(id: string) {
    const script = await prisma.script.findUnique({
      where: { id },
      include: { campaign: true },
    });
    if (!script) return null;
    return parseVapiConfig(script);
  }

  static async update(
    id: string,
    data: {
      name?: string;
      content?: string;
      vapiConfig?: Record<string, unknown>;
      campaignId?: string | null;
      isDefault?: boolean;
    }
  ) {
    const script = await prisma.script.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.vapiConfig !== undefined && { vapiConfig: JSON.stringify(data.vapiConfig) }),
        ...(data.campaignId !== undefined && { campaignId: data.campaignId }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });
    return parseVapiConfig(script);
  }

  static async delete(id: string) {
    const script = await prisma.script.findUnique({
      where: { id },
      include: { campaign: true },
    });
    if (!script) return null;
    if (script.campaign && script.campaign.status === "ACTIVE") {
      throw new Error("Cannot delete a script used in an active campaign");
    }
    return prisma.script.delete({ where: { id } });
  }

  static async duplicate(id: string) {
    const script = await prisma.script.findUnique({ where: { id } });
    if (!script) return null;

    const copy = await prisma.script.create({
      data: {
        name: `${script.name} (Copy)`,
        type: script.type,
        content: script.content,
        vapiConfig: script.vapiConfig,
        campaignId: null,
        isDefault: false,
      },
    });
    return parseVapiConfig(copy);
  }

  static renderTemplate(template: string, variables?: Record<string, string>): string {
    const vars = { ...TEMPLATE_VARIABLES, ...variables };
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return vars[key] ?? match;
    });
  }

  static getSampleVariables() {
    return TEMPLATE_VARIABLES;
  }
}
