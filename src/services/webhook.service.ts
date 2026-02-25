import { prisma } from "@/lib/db";
import { LeadService } from "./lead.service";
import { LeadRouterService } from "./lead-router.service";
import { RetentionSequenceService } from "./retention-sequence.service";

// ─── Types ───────────────────────────────────────────────────────────────────

type WebhookCreateInput = {
  name: string;
  type: "zapier" | "facebook" | "generic";
  sourceLabel?: string;
  isActive?: boolean;
  verifyToken?: string;
  pageAccessToken?: string;
  config?: Record<string, unknown>;
  campaignId?: string;
  sequenceId?: string;
  fieldMapping?: Record<string, string>;
};

type WebhookUpdateInput = {
  name?: string;
  type?: "zapier" | "facebook" | "generic";
  sourceLabel?: string;
  isActive?: boolean;
  verifyToken?: string;
  pageAccessToken?: string;
  config?: Record<string, unknown>;
  campaignId?: string | null;
  sequenceId?: string | null;
  fieldMapping?: Record<string, string>;
};

type InboundResult =
  | { success: true; leadId: string; deduplicated: boolean }
  | { challenge: string }
  | { error: string; status?: number };

type LeadFields = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  [key: string]: string | undefined;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const SLUG_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const SLUG_LENGTH = 8;

const LEAD_FIELD_KEYS = ["firstName", "lastName", "email", "phone"] as const;

// ─── Service ─────────────────────────────────────────────────────────────────

export class WebhookService {
  /**
   * List all webhooks with stats.
   */
  static async list() {
    const webhooks = await prisma.webhook.findMany({
      orderBy: { createdAt: "desc" },
      include: { campaign: true, sequence: true },
    });

    return webhooks.map((w) => ({
      ...w,
      config: w.config ? JSON.parse(w.config) : null,
      fieldMapping: w.fieldMapping ? JSON.parse(w.fieldMapping) : null,
    }));
  }

  /**
   * Get a single webhook by ID with full details.
   */
  static async getById(id: string) {
    const webhook = await prisma.webhook.findUnique({
      where: { id },
      include: { campaign: true, sequence: true },
    });

    if (!webhook) return null;

    return {
      ...webhook,
      config: webhook.config ? JSON.parse(webhook.config) : null,
      fieldMapping: webhook.fieldMapping ? JSON.parse(webhook.fieldMapping) : null,
    };
  }

  /**
   * Find webhook by slug (used by inbound receiver endpoint).
   */
  static async getBySlug(slug: string) {
    const webhook = await prisma.webhook.findUnique({
      where: { slug },
      include: { campaign: true, sequence: true },
    });

    if (!webhook) return null;

    return {
      ...webhook,
      config: webhook.config ? JSON.parse(webhook.config) : null,
      fieldMapping: webhook.fieldMapping ? JSON.parse(webhook.fieldMapping) : null,
    };
  }

  /**
   * Create a new webhook with auto-generated unique slug.
   */
  static async create(data: WebhookCreateInput) {
    // Validate campaign exists if provided
    if (data.campaignId) {
      const campaign = await prisma.campaign.findUnique({ where: { id: data.campaignId } });
      if (!campaign) throw new Error("Campaign not found");
    }

    // Validate sequence exists if provided
    if (data.sequenceId) {
      const sequence = await prisma.retentionSequence.findUnique({ where: { id: data.sequenceId } });
      if (!sequence) throw new Error("Sequence not found");
    }

    const slug = await this.generateSlug();

    const webhook = await prisma.webhook.create({
      data: {
        name: data.name,
        slug,
        type: data.type,
        sourceLabel: data.sourceLabel ?? null,
        isActive: data.isActive ?? true,
        verifyToken: data.verifyToken ?? null,
        pageAccessToken: data.pageAccessToken ?? null,
        config: data.config ? JSON.stringify(data.config) : null,
        campaignId: data.campaignId ?? null,
        sequenceId: data.sequenceId ?? null,
        fieldMapping: data.fieldMapping ? JSON.stringify(data.fieldMapping) : null,
      },
      include: { campaign: true, sequence: true },
    });

    return {
      ...webhook,
      config: webhook.config ? JSON.parse(webhook.config) : null,
      fieldMapping: webhook.fieldMapping ? JSON.parse(webhook.fieldMapping) : null,
    };
  }

  /**
   * Update webhook configuration.
   */
  static async update(id: string, data: WebhookUpdateInput) {
    const existing = await prisma.webhook.findUnique({ where: { id } });
    if (!existing) return null;

    // Validate campaign if provided
    if (data.campaignId) {
      const campaign = await prisma.campaign.findUnique({ where: { id: data.campaignId } });
      if (!campaign) throw new Error("Campaign not found");
    }

    // Validate sequence if provided
    if (data.sequenceId) {
      const sequence = await prisma.retentionSequence.findUnique({ where: { id: data.sequenceId } });
      if (!sequence) throw new Error("Sequence not found");
    }

    const webhook = await prisma.webhook.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.sourceLabel !== undefined && { sourceLabel: data.sourceLabel }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.verifyToken !== undefined && { verifyToken: data.verifyToken }),
        ...(data.pageAccessToken !== undefined && { pageAccessToken: data.pageAccessToken }),
        ...(data.config !== undefined && { config: data.config ? JSON.stringify(data.config) : null }),
        ...(data.campaignId !== undefined && { campaignId: data.campaignId }),
        ...(data.sequenceId !== undefined && { sequenceId: data.sequenceId }),
        ...(data.fieldMapping !== undefined && {
          fieldMapping: data.fieldMapping ? JSON.stringify(data.fieldMapping) : null,
        }),
      },
      include: { campaign: true, sequence: true },
    });

    return {
      ...webhook,
      config: webhook.config ? JSON.parse(webhook.config) : null,
      fieldMapping: webhook.fieldMapping ? JSON.parse(webhook.fieldMapping) : null,
    };
  }

  /**
   * Delete a webhook.
   */
  static async delete(id: string) {
    const existing = await prisma.webhook.findUnique({ where: { id } });
    if (!existing) return null;
    await prisma.webhook.delete({ where: { id } });
    return existing;
  }

  /**
   * Main inbound processing logic.
   * Handles GET (Facebook verification) and POST (lead data) requests.
   */
  static async processInbound(
    slug: string,
    method: "GET" | "POST",
    body: Record<string, unknown>,
    query: Record<string, string>
  ): Promise<InboundResult> {
    const webhook = await prisma.webhook.findUnique({ where: { slug } });
    if (!webhook) return { error: "Webhook not found", status: 404 };
    if (!webhook.isActive) return { error: "Webhook is inactive", status: 403 };

    // Facebook verification handshake (GET request)
    if (method === "GET" && webhook.type === "facebook") {
      return this.handleFacebookVerification(webhook, query);
    }

    if (method !== "POST") {
      return { error: "Method not allowed", status: 405 };
    }

    // Parse payload based on webhook type
    let fields: LeadFields;
    try {
      fields = await this.extractFields(webhook, body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to extract fields";
      return { error: msg, status: 400 };
    }

    // Must have at least email or phone
    if (!fields.email && !fields.phone) {
      return { error: "No email or phone found in payload", status: 400 };
    }

    // Create lead via LeadService
    const source = webhook.sourceLabel || `WEBHOOK_${webhook.type.toUpperCase()}`;
    const { lead, deduplicated } = await LeadService.create({
      firstName: fields.firstName || "",
      lastName: fields.lastName || "",
      email: fields.email,
      phone: fields.phone,
      source,
      meta: { webhookSlug: webhook.slug, webhookId: webhook.id, rawPayload: body },
    });

    // Update webhook stats
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastReceivedAt: new Date(),
        leadCount: { increment: 1 },
      },
    });

    // Route to campaign if configured
    if (webhook.campaignId) {
      const existing = await prisma.campaignLead.findUnique({
        where: { campaignId_leadId: { campaignId: webhook.campaignId, leadId: lead.id } },
      });
      if (!existing) {
        await prisma.campaignLead.create({
          data: { campaignId: webhook.campaignId, leadId: lead.id },
        });
      }
    }

    // Enroll in sequence if configured
    if (webhook.sequenceId) {
      RetentionSequenceService.enrollLead(webhook.sequenceId, lead.id).catch((err) => {
        console.error(`Webhook ${webhook.slug}: sequence enrollment failed for lead ${lead.id}:`, err);
      });
    }

    // Auto-route via LeadRouter if no specific campaign is configured
    if (!webhook.campaignId) {
      LeadRouterService.routeNewLead(lead.id).catch((err) => {
        console.error(`Webhook ${webhook.slug}: auto-routing failed for lead ${lead.id}:`, err);
      });
    }

    return { success: true, leadId: lead.id, deduplicated };
  }

  /**
   * Get recent leads received through this webhook.
   */
  static async getActivity(id: string, limit = 50) {
    const webhook = await prisma.webhook.findUnique({ where: { id } });
    if (!webhook) return null;

    const leads = await prisma.lead.findMany({
      where: {
        meta: { contains: webhook.id },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return leads;
  }

  /**
   * Generate a unique 8-character alphanumeric slug.
   */
  static async generateSlug(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      let slug = "";
      for (let i = 0; i < SLUG_LENGTH; i++) {
        slug += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
      }

      const existing = await prisma.webhook.findUnique({ where: { slug } });
      if (!existing) return slug;
    }

    throw new Error("Failed to generate unique slug after 10 attempts");
  }

  /**
   * Simulate a test lead through the webhook pipeline.
   */
  static async testWebhook(id: string) {
    const webhook = await prisma.webhook.findUnique({ where: { id } });
    if (!webhook) return { error: "Webhook not found" };

    const testPayload: Record<string, unknown> = {
      email: `test+${Date.now()}@webhook-test.local`,
      first_name: "Test",
      last_name: "Lead",
      phone: "+1555000" + Math.floor(Math.random() * 10000).toString().padStart(4, "0"),
    };

    // For facebook type, wrap in facebook lead format
    if (webhook.type === "facebook") {
      const fbPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  leadgen_id: "test_" + Date.now(),
                  field_data: [
                    { name: "email", values: [testPayload.email] },
                    { name: "first_name", values: [testPayload.first_name] },
                    { name: "last_name", values: [testPayload.last_name] },
                    { name: "phone_number", values: [testPayload.phone] },
                  ],
                },
              },
            ],
          },
        ],
      };

      return this.processInbound(webhook.slug, "POST", fbPayload, {});
    }

    return this.processInbound(webhook.slug, "POST", testPayload, {});
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Handle Facebook webhook verification handshake.
   */
  private static handleFacebookVerification(
    webhook: { verifyToken: string | null },
    query: Record<string, string>
  ): InboundResult {
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (mode === "subscribe" && token && token === webhook.verifyToken) {
      return { challenge: challenge || "" };
    }

    return { error: "Verification failed", status: 403 };
  }

  /**
   * Extract lead fields from the incoming payload based on webhook type.
   */
  private static async extractFields(
    webhook: { type: string; fieldMapping: string | null; pageAccessToken: string | null },
    body: Record<string, unknown>
  ): Promise<LeadFields> {
    let rawFields: Record<string, string> = {};

    switch (webhook.type) {
      case "facebook":
        rawFields = await this.parseFacebookPayload(webhook, body);
        break;
      case "zapier":
        rawFields = this.flattenPayload(body);
        break;
      case "generic":
      default:
        rawFields = this.flattenPayload(body);
        break;
    }

    // Apply field mapping
    return this.applyFieldMapping(rawFields, webhook.fieldMapping);
  }

  /**
   * Parse Facebook Lead Ads webhook payload.
   * Facebook sends: { entry: [{ changes: [{ value: { leadgen_id, field_data } }] }] }
   * If pageAccessToken is set, fetches full lead data from Graph API.
   */
  private static async parseFacebookPayload(
    webhook: { pageAccessToken: string | null },
    body: Record<string, unknown>
  ): Promise<Record<string, string>> {
    const entry = body.entry as Array<{
      changes: Array<{
        value: {
          leadgen_id?: string;
          field_data?: Array<{ name: string; values: string[] }>;
        };
      }>;
    }>;

    if (!entry?.[0]?.changes?.[0]?.value) {
      throw new Error("Invalid Facebook webhook payload");
    }

    const value = entry[0].changes[0].value;

    // If we have a page access token, fetch full lead data from Graph API
    if (webhook.pageAccessToken && value.leadgen_id) {
      try {
        return await this.fetchFacebookLead(value.leadgen_id, webhook.pageAccessToken);
      } catch (err) {
        console.error("Facebook Graph API fetch failed, falling back to payload data:", err);
      }
    }

    // Fall back to inline field_data
    if (!value.field_data) {
      throw new Error("No field_data in Facebook payload");
    }

    const fields: Record<string, string> = {};
    for (const field of value.field_data) {
      if (field.values?.[0]) {
        fields[field.name] = field.values[0];
      }
    }

    return fields;
  }

  /**
   * Fetch lead data from Facebook Graph API using leadgen_id.
   */
  private static async fetchFacebookLead(
    leadgenId: string,
    pageAccessToken: string
  ): Promise<Record<string, string>> {
    const url = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${encodeURIComponent(pageAccessToken)}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Facebook Graph API error: ${res.status}`);
    }

    const data = (await res.json()) as {
      field_data?: Array<{ name: string; values: string[] }>;
    };

    if (!data.field_data) {
      throw new Error("No field_data in Graph API response");
    }

    const fields: Record<string, string> = {};
    for (const field of data.field_data) {
      if (field.values?.[0]) {
        fields[field.name] = field.values[0];
      }
    }

    return fields;
  }

  /**
   * Flatten a nested object payload into a flat key-value map.
   * Only extracts top-level string values (one level deep).
   */
  private static flattenPayload(body: Record<string, unknown>): Record<string, string> {
    const fields: Record<string, string> = {};

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") {
        fields[key] = value;
      } else if (typeof value === "number" || typeof value === "boolean") {
        fields[key] = String(value);
      }
    }

    return fields;
  }

  /**
   * Apply field mapping to translate incoming field names to Lead field names.
   * If no mapping is configured, attempts direct matching of common field names.
   */
  private static applyFieldMapping(
    rawFields: Record<string, string>,
    fieldMappingJson: string | null
  ): LeadFields {
    const result: LeadFields = {};

    if (fieldMappingJson) {
      const mapping = JSON.parse(fieldMappingJson) as Record<string, string>;

      // mapping: { incomingKey: leadField }
      for (const [incomingKey, leadField] of Object.entries(mapping)) {
        if (rawFields[incomingKey] && LEAD_FIELD_KEYS.includes(leadField as typeof LEAD_FIELD_KEYS[number])) {
          result[leadField] = rawFields[incomingKey];
        }
      }
    } else {
      // No mapping — try common field name patterns
      const commonMappings: Record<string, string> = {
        email: "email",
        e_mail: "email",
        mail: "email",
        phone: "phone",
        phone_number: "phone",
        tel: "phone",
        telephone: "phone",
        mobile: "phone",
        first_name: "firstName",
        firstName: "firstName",
        firstname: "firstName",
        nome: "firstName",
        last_name: "lastName",
        lastName: "lastName",
        lastname: "lastName",
        cognome: "lastName",
        full_name: "firstName",
        name: "firstName",
      };

      for (const [rawKey, rawValue] of Object.entries(rawFields)) {
        const mappedField = commonMappings[rawKey] || commonMappings[rawKey.toLowerCase()];
        if (mappedField && !result[mappedField]) {
          result[mappedField] = rawValue;
        }
      }
    }

    return result;
  }
}
