/**
 * Offer Link Service
 * Generates Keitaro-tracked offer links via Hermes API.
 * Falls back to direct Keitaro link if Hermes is unreachable.
 */

const HERMES_API_URL = process.env.HERMES_API_URL || "https://ag5.q37fh758g.click";
const KEITARO_BASE_URL = process.env.KEITARO_BASE_URL || "https://keitaro.q37fh758g.click";

// In-memory cache: key = `${source}:${campaignId}:${leadId}` => { link, expiry }
const linkCache = new Map<string, { offerLink: string; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export type OfferLinkSource = "retention_email" | "retention_sms" | "retention_call";

export interface OfferLinkParams {
  source: OfferLinkSource;
  campaignId?: string;
  sequenceStepId?: string;
  channel?: string;
  leadId: string;
  leadExternalId?: string | null;
}

export interface OfferLinkResult {
  offerLink: string;
  clickId?: string;
  fromCache: boolean;
  fallback: boolean;
}

function buildCacheKey(params: OfferLinkParams): string {
  return `${params.source}:${params.campaignId ?? "none"}:${params.leadId}`;
}

function buildFallbackLink(params: OfferLinkParams): string {
  const url = new URL(`${KEITARO_BASE_URL}/`);
  url.searchParams.set("sub_id_1", params.source);
  url.searchParams.set("sub_id_2", params.campaignId ?? "");
  url.searchParams.set("sub_id_3", params.sequenceStepId ?? "");
  url.searchParams.set("sub_id_4", params.leadId);
  url.searchParams.set("sub_id_5", params.channel ?? "");
  return url.toString();
}

export class OfferLinkService {
  /**
   * Generate a Keitaro-tracked offer link for a lead.
   * Tries Hermes API first, falls back to direct Keitaro link.
   */
  static async generateOfferLink(params: OfferLinkParams): Promise<OfferLinkResult> {
    // Check cache
    const cacheKey = buildCacheKey(params);
    const cached = linkCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { offerLink: cached.offerLink, fromCache: true, fallback: false };
    }

    // Try Hermes API
    try {
      const res = await fetch(`${HERMES_API_URL}/api/offer-links/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: params.source,
          source_id: params.campaignId ?? "",
          source_detail: params.sequenceStepId ?? "",
          source_subtype: params.channel ?? "",
          user_id: params.leadId,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          offer_link?: string;
          click_id?: string;
        };

        if (data.offer_link) {
          // Cache the result
          linkCache.set(cacheKey, {
            offerLink: data.offer_link,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });

          return {
            offerLink: data.offer_link,
            clickId: data.click_id,
            fromCache: false,
            fallback: false,
          };
        }
      }

      console.warn(
        `[OfferLinkService] Hermes API returned non-ok (${res.status}), using fallback`
      );
    } catch (err) {
      console.warn(
        `[OfferLinkService] Hermes API unreachable: ${(err as Error).message}, using fallback`
      );
    }

    // Fallback: build direct Keitaro link
    const fallbackLink = buildFallbackLink(params);
    linkCache.set(cacheKey, {
      offerLink: fallbackLink,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return { offerLink: fallbackLink, fromCache: false, fallback: true };
  }

  /**
   * Clear expired entries from cache.
   */
  static clearExpiredCache(): number {
    const now = Date.now();
    let cleared = 0;
    for (const [key, value] of linkCache) {
      if (value.expiresAt <= now) {
        linkCache.delete(key);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Clear all cached links.
   */
  static clearCache(): void {
    linkCache.clear();
  }
}
