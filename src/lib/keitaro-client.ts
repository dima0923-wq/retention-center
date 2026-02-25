/**
 * Keitaro API Client
 * Communicates with Keitaro tracker REST API v1
 */

const KEITARO_BASE_URL = process.env.KEITARO_BASE_URL || "";
const KEITARO_API_KEY = process.env.KEITARO_API_KEY || "";

export interface KeitaroCampaign {
  id: number;
  name: string;
  alias: string;
  state: string;
  cost_type: string;
  cost_value: number;
  daily_budget: number | null;
  total_budget: number | null;
  created_at: string;
  updated_at: string;
}

export interface KeitaroOffer {
  id: number;
  name: string;
  url: string;
  affiliate_network_id: number | null;
  payout_value: number;
  payout_currency: string;
  payout_type: string;
  created_at: string;
  updated_at: string;
}

export interface KeitaroAffiliateNetwork {
  id: number;
  name: string;
  postback_url: string | null;
  offer_param: string | null;
  created_at: string;
  updated_at: string;
}

export interface KeitaroDateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface KeitaroStatsRow {
  campaign_id?: number;
  campaign_name?: string;
  clicks: number;
  unique_clicks: number;
  conversions: number;
  revenue: number;
  cost: number;
  profit: number;
  roi: number;
  cr: number;
  date?: string;
}

export interface KeitaroStatsResponse {
  rows: KeitaroStatsRow[];
  total: KeitaroStatsRow;
}

export interface KeitaroClickLogEntry {
  id: string;
  datetime: string;
  campaign_id: number;
  campaign_name: string;
  sub_id: string | null;
  ip: string;
  country: string;
  browser: string;
  os: string;
  device: string;
  referrer: string | null;
  keyword: string | null;
}

export interface KeitaroConversionLogEntry {
  id: string;
  datetime: string;
  campaign_id: number;
  campaign_name: string;
  sub_id: string | null;
  click_id: string | null;
  status: string;
  revenue: number;
  payout: number;
  external_id: string | null;
}

export interface KeitaroClickLogParams {
  campaign_id?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  sub_id?: string;
}

export interface KeitaroConversionLogParams {
  campaign_id?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  status?: string;
  sub_id?: string;
}

export class KeitaroError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "KeitaroError";
    this.status = status;
  }
}

export class KeitaroClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = (baseUrl ?? KEITARO_BASE_URL).replace(/\/$/, "");
    this.apiKey = apiKey ?? KEITARO_API_KEY;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    if (!this.baseUrl) {
      throw new KeitaroError("KEITARO_BASE_URL is not configured", 500);
    }
    if (!this.apiKey) {
      throw new KeitaroError("KEITARO_API_KEY is not configured", 500);
    }

    const url = `${this.baseUrl}/api/v1${path}`;
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "Api-Key": this.apiKey,
      },
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new KeitaroError(
        `Keitaro API error ${res.status}: ${text}`,
        res.status
      );
    }

    return res.json() as Promise<T>;
  }

  /** List all campaigns */
  async listCampaigns(): Promise<KeitaroCampaign[]> {
    return this.request<KeitaroCampaign[]>("GET", "/campaigns");
  }

  /** Get a single campaign by ID */
  async getCampaign(id: number): Promise<KeitaroCampaign> {
    return this.request<KeitaroCampaign>("GET", `/campaigns/${id}`);
  }

  /** Get campaign statistics for a date range */
  async getCampaignStats(
    id: number,
    dateRange: KeitaroDateRange
  ): Promise<KeitaroStatsResponse> {
    return this.request<KeitaroStatsResponse>("POST", "/report/build", {
      range: {
        from: dateRange.from,
        to: dateRange.to,
        timezone: "UTC",
      },
      filters: [
        {
          name: "campaign_id",
          operator: "EQUALS",
          expression: String(id),
        },
      ],
      grouping: ["campaign_id", "campaign_name"],
      metrics: [
        "clicks",
        "unique_clicks",
        "conversions",
        "revenue",
        "cost",
        "profit",
        "roi",
        "cr",
      ],
    });
  }

  /** List all offers */
  async listOffers(): Promise<KeitaroOffer[]> {
    return this.request<KeitaroOffer[]>("GET", "/offers");
  }

  /** List all affiliate networks */
  async listAffiliateNetworks(): Promise<KeitaroAffiliateNetwork[]> {
    return this.request<KeitaroAffiliateNetwork[]>("GET", "/affiliate_networks");
  }

  /** Fetch click log entries */
  async getClickLog(
    params: KeitaroClickLogParams = {}
  ): Promise<KeitaroClickLogEntry[]> {
    const query = new URLSearchParams();
    if (params.campaign_id !== undefined)
      query.set("campaign_id", String(params.campaign_id));
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.offset !== undefined) query.set("offset", String(params.offset));
    if (params.sub_id) query.set("sub_id", params.sub_id);

    const qs = query.toString();
    return this.request<KeitaroClickLogEntry[]>(
      "GET",
      `/log/clicks${qs ? `?${qs}` : ""}`
    );
  }

  /** Fetch conversion log entries */
  async getConversionLog(
    params: KeitaroConversionLogParams = {}
  ): Promise<KeitaroConversionLogEntry[]> {
    const query = new URLSearchParams();
    if (params.campaign_id !== undefined)
      query.set("campaign_id", String(params.campaign_id));
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.offset !== undefined) query.set("offset", String(params.offset));
    if (params.status) query.set("status", params.status);
    if (params.sub_id) query.set("sub_id", params.sub_id);

    const qs = query.toString();
    return this.request<KeitaroConversionLogEntry[]>(
      "GET",
      `/log/conversions${qs ? `?${qs}` : ""}`
    );
  }

  /** Test the API connection — returns true if the key is valid */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.request<unknown>("GET", "/me");
      return { ok: true, message: "Connection successful" };
    } catch (err) {
      if (err instanceof KeitaroError) {
        return { ok: false, message: err.message };
      }
      return { ok: false, message: "Unknown error" };
    }
  }
}

/** Singleton client using env vars */
export const keitaroClient = new KeitaroClient();
