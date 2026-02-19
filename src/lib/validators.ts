import { z } from "zod";

export const leadCreateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  email: z.string().optional().transform(v => (!v || v.trim() === "") ? undefined : v),
  source: z.enum(["META", "MANUAL", "API"]).default("MANUAL"),
  externalId: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
});

export const leadUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().optional().transform(v => (!v || v.trim() === "") ? undefined : v),
  status: z.enum(["NEW", "CONTACTED", "IN_PROGRESS", "CONVERTED", "LOST", "DO_NOT_CONTACT"]).optional(),
  notes: z.string().optional(),
});

export const leadFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["NEW", "CONTACTED", "IN_PROGRESS", "CONVERTED", "LOST", "DO_NOT_CONTACT"]).optional(),
  source: z.enum(["META", "MANUAL", "API"]).optional(),
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

// Campaign validators
export const campaignCreateSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(200),
  description: z.string().max(2000).optional(),
  channels: z.array(z.enum(["CALL", "SMS", "EMAIL"])).min(1, "At least one channel is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const campaignUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  channels: z.array(z.enum(["CALL", "SMS", "EMAIL"])).min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
});

export const campaignFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default("createdAt"),
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
