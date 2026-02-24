import { prisma } from "@/lib/db";

interface LeadMeta {
  ugid?: string;
  pwaId?: number;
  pwaLinkedAt?: string;
  [key: string]: unknown;
}

function parseMeta(meta: string | null | undefined): LeadMeta {
  if (!meta) return {};
  try {
    return JSON.parse(meta);
  } catch {
    return {};
  }
}

export function getLeadUgid(lead: { meta?: string | null }): string | null {
  const meta = parseMeta(lead.meta);
  return meta.ugid ?? null;
}

export function getLeadPwaId(lead: { meta?: string | null }): number | null {
  const meta = parseMeta(lead.meta);
  return meta.pwaId ?? null;
}

export async function setLeadUgid(
  leadId: string,
  ugid: string,
  pwaId?: number
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const meta = parseMeta(lead.meta);
  meta.ugid = ugid;
  if (pwaId !== undefined) meta.pwaId = pwaId;
  meta.pwaLinkedAt = new Date().toISOString();

  return prisma.lead.update({
    where: { id: leadId },
    data: { meta: JSON.stringify(meta) },
  });
}

export async function removeLeadUgid(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const meta = parseMeta(lead.meta);
  delete meta.ugid;
  delete meta.pwaId;
  delete meta.pwaLinkedAt;

  return prisma.lead.update({
    where: { id: leadId },
    data: { meta: JSON.stringify(meta) },
  });
}

export async function getLeadsWithUgid() {
  const allLeads = await prisma.lead.findMany({
    where: { meta: { not: null } },
  });
  return allLeads.filter((lead) => {
    const meta = parseMeta(lead.meta);
    return !!meta.ugid;
  });
}
