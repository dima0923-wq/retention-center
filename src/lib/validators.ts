import { z } from "zod";

export const leadCreateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  email: z.string().email().optional().transform(v => (!v || v.trim() === "") ? undefined : v),
  source: z.enum(["META", "MANUAL", "API", "WEBHOOK"]).default("MANUAL"),
  externalId: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
});

export const leadUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().transform(v => (!v || v.trim() === "") ? undefined : v),
  status: z.enum(["NEW", "CONTACTED", "IN_PROGRESS", "CONVERTED", "LOST", "DO_NOT_CONTACT"]).optional(),
  notes: z.string().optional(),
});

export const leadFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["NEW", "CONTACTED", "IN_PROGRESS", "CONVERTED", "LOST", "DO_NOT_CONTACT"]).optional(),
  source: z.enum(["META", "MANUAL", "API", "WEBHOOK"]).optional(),
  scoreLabel: z.enum(["HOT", "WARM", "COLD", "DEAD", "NEW"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const leadBulkCreateSchema = z.object({
  leads: z.array(leadCreateSchema).min(1).max(1000),
});

// Email sequence step schema
export const emailSequenceStepSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  delayValue: z.number().int().min(0),
  delayUnit: z.enum(["HOURS", "DAYS", "WEEKS"]),
});

// Auto-assignment schema
export const autoAssignSchema = z.object({
  enabled: z.boolean(),
  sources: z.array(z.enum(["META", "API", "MANUAL", "BULK", "WEBHOOK"])).optional(),
  maxLeads: z.number().int().min(1).optional(),
  executionMode: z.enum(["parallel", "sequential"]).optional(),
});

// VAPI campaign-level config schema
export const vapiConfigSchema = z.object({
  assistantId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  voice: z.string().optional(),
  model: z.string().optional(),
  firstMessage: z.string().optional(),
  instructions: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
});

// Campaign validators
export const campaignCreateSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(200),
  description: z.string().max(2000).optional(),
  channels: z.array(z.enum(["CALL", "SMS", "EMAIL"])).min(1, "At least one channel is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  instantlySync: z.boolean().optional(),
  emailSequence: z.array(emailSequenceStepSchema).optional(),
  emailTemplateId: z.string().optional(),
  // Schedule & rate limiting
  contactHoursStart: z.string().optional(),
  contactHoursEnd: z.string().optional(),
  contactDays: z.array(z.number().int().min(0).max(6)).optional(),
  maxContactsPerDay: z.number().int().min(1).optional(),
  delayBetweenChannels: z.number().min(0).optional(),
  // Auto-assignment
  autoAssign: autoAssignSchema.optional(),
  // VAPI campaign-level overrides
  vapiConfig: vapiConfigSchema.optional(),
});

export const campaignUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  channels: z.array(z.enum(["CALL", "SMS", "EMAIL"])).min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  instantlySync: z.boolean().optional(),
  emailSequence: z.array(emailSequenceStepSchema).optional(),
  emailTemplateId: z.string().optional(),
  // Schedule & rate limiting
  contactHoursStart: z.string().optional(),
  contactHoursEnd: z.string().optional(),
  contactDays: z.array(z.number().int().min(0).max(6)).optional(),
  maxContactsPerDay: z.number().int().min(1).optional(),
  delayBetweenChannels: z.number().min(0).optional(),
  // Auto-assignment
  autoAssign: autoAssignSchema.optional(),
  // VAPI campaign-level overrides
  vapiConfig: vapiConfigSchema.optional(),
});

export const campaignFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "status", "startDate", "endDate"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const campaignLeadsSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1, "At least one lead is required"),
});

// Script validators
export const scriptCreateSchema = z.object({
  name: z.string().min(1, "Script name is required").max(200),
  type: z.enum(["CALL", "SMS", "EMAIL"]),
  content: z.string().optional(),
  vapiConfig: z.record(z.string(), z.unknown()).optional(),
  campaignId: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export const scriptUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  vapiConfig: z.record(z.string(), z.unknown()).optional(),
  campaignId: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const scriptFiltersSchema = z.object({
  type: z.enum(["CALL", "SMS", "EMAIL"]).optional(),
  campaignId: z.string().optional(),
  search: z.string().optional(),
});

// ─── Email Template Validators ─────────────────────────────────────────────

export const emailTemplateCreateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  subject: z.string().min(1, "Subject is required").max(500),
  htmlBody: z.string().min(1, "HTML body is required"),
  textBody: z.string().optional(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().max(200).optional(),
  trigger: z.string().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  variables: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const emailTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(500).optional(),
  htmlBody: z.string().min(1).optional(),
  textBody: z.string().nullable().optional(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().max(200).optional(),
  trigger: z.string().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  variables: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const emailTemplateFiltersSchema = z.object({
  trigger: z.string().optional(),
  isActive: z.enum(["true", "false"]).transform(v => v === "true").optional(),
  search: z.string().optional(),
});

// ─── Retention Sequence Validators ──────────────────────────────────────────

export const sequenceStepSchema = z.object({
  stepOrder: z.number().int().min(1),
  channel: z.enum(["EMAIL", "SMS", "CALL"]),
  scriptId: z.string().optional(),
  delayValue: z.number().int().min(0).default(0),
  delayUnit: z.enum(["HOURS", "DAYS", "WEEKS"]).default("HOURS"),
  conditions: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().default(true),
});

export const sequenceCreateSchema = z.object({
  name: z.string().min(1, "Sequence name is required").max(200),
  description: z.string().max(2000).optional(),
  channels: z.array(z.enum(["EMAIL", "SMS", "CALL"])).min(1, "At least one channel is required"),
  triggerType: z.enum(["new_lead", "no_conversion", "manual"]).default("manual"),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
  steps: z.array(sequenceStepSchema).optional(),
});

export const sequenceUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  channels: z.array(z.enum(["EMAIL", "SMS", "CALL"])).min(1).optional(),
  triggerType: z.enum(["new_lead", "no_conversion", "manual"]).optional(),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  steps: z.array(sequenceStepSchema).optional(),
});

export const sequenceFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  triggerType: z.enum(["new_lead", "no_conversion", "manual"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const sequenceEnrollSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1, "At least one lead is required"),
});

export const enrollmentFiltersSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED", "CONVERTED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Contact Attempt Validators ──────────────────────────────────────────────

export const contactAttemptCreateSchema = z.object({
  channel: z.enum(["CALL", "SMS", "EMAIL"]),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "NO_ANSWER", "VOICEMAIL"]),
  leadId: z.string().min(1),
  campaignId: z.string().min(1),
  scriptId: z.string().min(1),
  result: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Conversion Validators ───────────────────────────────────────────────────

export const conversionCreateSchema = z.object({
  leadId: z.string().min(1),
  campaignId: z.string().min(1),
  contactAttemptId: z.string().optional(),
  source: z.string().min(1),
  revenue: z.number().optional(),
  subId: z.string().optional(),
  status: z.string().min(1),
});

// ─── AB Test Validators ──────────────────────────────────────────────────────

export const abTestCreateSchema = z.object({
  campaignId: z.string().min(1),
  variantA: z.string().min(1),
  variantB: z.string().min(1),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]).optional().default("ACTIVE"),
});

// ─── Conversion Rule Validators ───────────────────────────────────────────────

export const conversionRuleCreateSchema = z.object({
  channel: z.enum(["CALL", "SMS", "EMAIL"]),
  condition: z.string().min(1),
  value: z.string().min(1),
  score: z.number(),
});

// ─── Webhook Validators ──────────────────────────────────────────────────────

export const webhookCreateSchema = z.object({
  name: z.string().min(1, "Webhook name is required").max(200),
  type: z.enum(["zapier", "facebook", "generic"]).default("generic"),
  sourceLabel: z.string().min(1, "Source label is required").max(50),
  isActive: z.boolean().default(true),
  verifyToken: z.string().optional(),
  pageAccessToken: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  campaignId: z.string().optional(),
  sequenceId: z.string().optional(),
  fieldMapping: z.record(z.string(), z.string()).optional(),
});

export const webhookUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(["zapier", "facebook", "generic"]).optional(),
  sourceLabel: z.string().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  verifyToken: z.string().nullable().optional(),
  pageAccessToken: z.string().nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  campaignId: z.string().nullable().optional(),
  sequenceId: z.string().nullable().optional(),
  fieldMapping: z.record(z.string(), z.string()).optional(),
});

export const webhookFiltersSchema = z.object({
  search: z.string().optional(),
  type: z.enum(["zapier", "facebook", "generic"]).optional(),
  isActive: z.enum(["true", "false"]).transform(v => v === "true").optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "type", "leadCount"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
