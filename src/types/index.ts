import type { Lead, ContactAttempt, Campaign, CampaignLead, Script } from "@/generated/prisma/client";

export type PaginationParams = {
  page: number;
  pageSize: number;
};

export type LeadFilters = {
  search?: string;
  status?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type LeadCreateInput = {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  source?: string;
  externalId?: string;
  meta?: Record<string, unknown>;
  notes?: string;
};

export type LeadUpdateInput = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  status?: string;
  notes?: string;
};

export type LeadListResponse = {
  data: Lead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type LeadWithAttempts = Lead & {
  contactAttempts: ContactAttempt[];
};

export type LeadStats = {
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
};

// Campaign types
export type CampaignFilters = {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type CampaignCreateInput = {
  name: string;
  description?: string;
  channels: string[];
  startDate?: string;
  endDate?: string;
};

export type CampaignUpdateInput = {
  name?: string;
  description?: string;
  channels?: string[];
  startDate?: string;
  endDate?: string;
  status?: string;
};

export type CampaignListResponse = {
  data: CampaignWithCounts[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CampaignWithCounts = Campaign & {
  _count: { campaignLeads: number };
};

export type CampaignDetail = Campaign & {
  campaignLeads: (CampaignLead & { lead: Lead })[];
  scripts: Script[];
  _count: { campaignLeads: number };
};

export type CampaignStats = {
  totalLeads: number;
  byStatus: Record<string, number>;
  conversionRate: number;
};
