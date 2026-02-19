import type { Lead, ContactAttempt, Campaign, CampaignLead, Script, RetentionSequence, SequenceStep, SequenceEnrollment, SequenceStepExecution, Conversion, ConversionRule, ABTest } from "@/generated/prisma/client";

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
  campaignLeads?: (CampaignLead & { campaign: Campaign })[];
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

export type EmailSequenceStep = {
  subject: string;
  body: string;
  delayValue: number;
  delayUnit: "HOURS" | "DAYS" | "WEEKS";
};

export type AutoAssignConfig = {
  enabled: boolean;
  sources?: ("META" | "API" | "MANUAL" | "BULK")[];
  maxLeads?: number;
  executionMode?: "parallel" | "sequential";
};

export type CampaignVapiConfig = {
  assistantId?: string;
  phoneNumberId?: string;
  voice?: string;
  model?: string;
  firstMessage?: string;
  instructions?: string;
  temperature?: number;
};

export type CampaignCreateInput = {
  name: string;
  description?: string;
  channels: string[];
  startDate?: string;
  endDate?: string;
  instantlySync?: boolean;
  emailSequence?: EmailSequenceStep[];
  contactHoursStart?: string;
  contactHoursEnd?: string;
  contactDays?: number[];
  maxContactsPerDay?: number;
  delayBetweenChannels?: number;
  autoAssign?: AutoAssignConfig;
  vapiConfig?: CampaignVapiConfig;
};

export type CampaignUpdateInput = {
  name?: string;
  description?: string;
  channels?: string[];
  startDate?: string;
  endDate?: string;
  status?: string;
  instantlySync?: boolean;
  emailSequence?: EmailSequenceStep[];
  contactHoursStart?: string;
  contactHoursEnd?: string;
  contactDays?: number[];
  maxContactsPerDay?: number;
  delayBetweenChannels?: number;
  autoAssign?: AutoAssignConfig;
  vapiConfig?: CampaignVapiConfig;
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

// Instantly API types
export type InstantlyConfig = {
  apiKey: string;
  defaultCampaignId?: string;
};

export type InstantlyCampaign = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type InstantlyLead = {
  email: string;
  first_name?: string;
  last_name?: string;
  campaign_id?: string;
  custom_variables?: Record<string, string>;
};

export type InstantlyAccount = {
  id: string;
  email: string;
  status: string;
  warmup_status?: string;
};

export type InstantlyWebhookEvent = {
  event_type: string;
  timestamp: string;
  data: {
    campaign_id?: string;
    lead_email?: string;
    email_id?: string;
    account_email?: string;
    [key: string]: unknown;
  };
};

export type InstantlyAnalytics = {
  campaign_id: string;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_replied: number;
  total_bounced: number;
  total_unsubscribed: number;
};

export type EmailStats = {
  totalSent: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
};

// ─── Prisma model re-exports ──────────────────────────────────────────────────

export type {
  RetentionSequence,
  SequenceStep,
  SequenceEnrollment,
  SequenceStepExecution,
  Conversion,
  ConversionRule,
  ABTest,
};
