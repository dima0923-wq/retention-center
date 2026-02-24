import type { Lead, Script } from "@/generated/prisma/client";
import { pwaflowService, PwaFlowServiceError } from "@/services/pwaflow.service";
import type { PwaFlowPush, PwaFlowPaginationMeta } from "@/types/pwaflow";

// ── Instant Push API ────────────────────────────────────────────────────────

const INSTANT_PUSH_URL = "https://pwaflow.com/push/create/instant";

function getInstantPushApiKey(): string {
  const key = process.env.PWAFLOW_INSTANT_PUSH_API_KEY;
  if (!key) throw new PushServiceError("PWAFLOW_INSTANT_PUSH_API_KEY env var is not set");
  return key;
}

// ── Error class ─────────────────────────────────────────────────────────────

export class PushServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "PushServiceError";
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

export type InstantPushParams = {
  userIds: string[];
  internalName: string;
  title: string;
  text: string;
  image?: string;
};

type InstantPushResponse = {
  success: boolean;
  error?: string;
};

// ── Service class ───────────────────────────────────────────────────────────

export class PushService {
  /**
   * Send an instant push notification via PwaFlow.
   * Does NOT create a ContactAttempt — the caller (channel-router) handles that.
   */
  static async sendInstantPush(
    params: InstantPushParams,
  ): Promise<{ providerRef: string } | { error: string }> {
    const apiKey = getInstantPushApiKey();

    try {
      const res = await fetch(INSTANT_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          users_ids: params.userIds,
          internal_name: params.internalName,
          title: params.title,
          text: params.text,
          ...(params.image ? { image: params.image } : {}),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { error: `PwaFlow instant push error ${res.status}: ${errText}` };
      }

      const data = (await res.json()) as InstantPushResponse;
      if (!data.success) {
        return { error: data.error ?? "Instant push failed" };
      }

      // PwaFlow instant push doesn't return a message ID, use timestamp as ref
      return { providerRef: `pwaflow-push-${Date.now()}` };
    } catch (e) {
      return { error: `Push send error: ${(e as Error).message}` };
    }
  }

  /**
   * Send push to a lead using a script (channel-router compatible).
   * Requires lead to have a pwaUserId stored in meta.
   */
  static async sendPush(
    lead: Lead,
    script: Script,
  ): Promise<{ providerRef: string } | { error: string }> {
    // Extract PwaFlow user ID from lead meta
    const meta = lead.meta ? (typeof lead.meta === "string" ? JSON.parse(lead.meta) : lead.meta) as Record<string, unknown> : {};
    const pwaUserId = meta.pwaUserId as string | undefined;

    if (!pwaUserId) {
      return { error: "Lead has no PwaFlow user ID (meta.pwaUserId)" };
    }

    const title = script.name;
    const text = replaceVariables(script.content ?? "", lead);

    return PushService.sendInstantPush({
      userIds: [pwaUserId],
      internalName: `rc-${lead.id}-${Date.now()}`,
      title,
      text,
    });
  }

  // ── Read-only PwaFlow push campaign methods ───────────────

  static async listPushCampaigns(
    page?: number,
    limit?: number,
  ): Promise<{ pushes: PwaFlowPush[]; meta: PwaFlowPaginationMeta }> {
    return pwaflowService.listPushes({ page, limit });
  }

  static async getPushCampaign(id: number): Promise<PwaFlowPush> {
    return pwaflowService.getPush(id);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function replaceVariables(template: string, lead: Lead): string {
  return template
    .replace(/\{\{firstName\}\}/g, lead.firstName)
    .replace(/\{\{lastName\}\}/g, lead.lastName)
    .replace(/\{\{phone\}\}/g, lead.phone ?? "")
    .replace(/\{\{email\}\}/g, lead.email ?? "");
}

// ── Singleton-style export for convenience ──────────────────────────────────

export const pushService = PushService;
