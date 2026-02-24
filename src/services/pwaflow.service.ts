import type {
  PwaFlowPwa,
  PwaFlowDomain,
  PwaFlowPush,
  PwaFlowMetaPixel,
  PwaFlowStatisticsData,
  PwaFlowPaginationMeta,
  PwaFlowListParams,
  PwaFlowStatisticsParams,
  PwaFlowErrorResponse,
} from "@/types/pwaflow";

// ── Configuration ───────────────────────────────────────────────────────────

const PWAFLOW_BASE_URL = "https://pwaflow.com";

function getApiKey(): string {
  const key = process.env.PWAFLOW_API_KEY;
  if (!key) throw new PwaFlowServiceError("PWAFLOW_API_KEY env var is not set", 0);
  return key;
}

// ── Error class ─────────────────────────────────────────────────────────────

export class PwaFlowServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public apiError?: string,
  ) {
    super(message);
    this.name = "PwaFlowServiceError";
  }
}

// ── Internal fetch helper ───────────────────────────────────────────────────

async function pwaFlowFetch<T>(
  path: string,
  params?: Record<string, string | string[]>,
): Promise<T> {
  const url = new URL(`${PWAFLOW_BASE_URL}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) {
          url.searchParams.append(`${key}[]`, v);
        }
      } else {
        url.searchParams.set(key, value);
      }
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    let apiError: string | undefined;
    try {
      const body = (await res.json()) as PwaFlowErrorResponse;
      apiError = body.error?.error ?? JSON.stringify(body);
    } catch {
      apiError = await res.text().catch(() => undefined);
    }
    throw new PwaFlowServiceError(
      `PwaFlow API error ${res.status}: ${apiError ?? res.statusText}`,
      res.status,
      apiError,
    );
  }

  const json = await res.json();
  return json as T;
}

// ── Helper to build query params ────────────────────────────────────────────

function listParams(p?: PwaFlowListParams): Record<string, string> | undefined {
  if (!p) return undefined;
  const out: Record<string, string> = {};
  if (p.page !== undefined) out.page = String(p.page);
  if (p.limit !== undefined) out.limit = String(p.limit);
  if (p.archived !== undefined) out.archived = String(p.archived);
  return Object.keys(out).length > 0 ? out : undefined;
}

// ── Service class ───────────────────────────────────────────────────────────

type PwaListData = { pwas: PwaFlowPwa[]; meta: PwaFlowPaginationMeta };
type DomainListData = { domains: PwaFlowDomain[]; meta: PwaFlowPaginationMeta };
type PushListData = { pushes: PwaFlowPush[]; meta: PwaFlowPaginationMeta };
type MetaPixelListData = { meta_pixels: PwaFlowMetaPixel[]; meta: PwaFlowPaginationMeta };

type SuccessWrapper<T> = { result: "success"; data: T };

class PwaFlowService {
  // ── PWAs ────────────────────────────────────────────────────

  async listPwas(params?: PwaFlowListParams) {
    const res = await pwaFlowFetch<SuccessWrapper<PwaListData>>(
      "/api/v1/pwas",
      listParams(params),
    );
    return res.data;
  }

  async getPwa(id: number) {
    const res = await pwaFlowFetch<SuccessWrapper<{ pwa: PwaFlowPwa }>>(
      `/api/v1/pwas/${id}`,
    );
    return res.data.pwa;
  }

  // ── Domains ─────────────────────────────────────────────────

  async listDomains(params?: Omit<PwaFlowListParams, "archived">) {
    const p: Record<string, string> = {};
    if (params?.page !== undefined) p.page = String(params.page);
    if (params?.limit !== undefined) p.limit = String(params.limit);
    const res = await pwaFlowFetch<SuccessWrapper<DomainListData>>(
      "/api/v1/domains",
      Object.keys(p).length > 0 ? p : undefined,
    );
    return res.data;
  }

  async getDomain(id: number) {
    const res = await pwaFlowFetch<SuccessWrapper<{ domain: PwaFlowDomain }>>(
      `/api/v1/domains/${id}`,
    );
    return res.data.domain;
  }

  // ── Pushes ──────────────────────────────────────────────────

  async listPushes(params?: PwaFlowListParams) {
    const res = await pwaFlowFetch<SuccessWrapper<PushListData>>(
      "/api/v1/pushes",
      listParams(params),
    );
    return res.data;
  }

  async getPush(id: number) {
    const res = await pwaFlowFetch<SuccessWrapper<{ push: PwaFlowPush }>>(
      `/api/v1/pushes/${id}`,
    );
    return res.data.push;
  }

  // ── Meta Pixels ─────────────────────────────────────────────

  async listMetaPixels() {
    const res = await pwaFlowFetch<SuccessWrapper<MetaPixelListData>>(
      "/api/v1/meta-pixels",
    );
    return res.data;
  }

  async getMetaPixel(id: number) {
    const res = await pwaFlowFetch<SuccessWrapper<{ meta_pixel: PwaFlowMetaPixel }>>(
      `/api/v1/meta-pixels/${id}`,
    );
    return res.data.meta_pixel;
  }

  // ── Statistics ──────────────────────────────────────────────

  async getStatistics(params?: PwaFlowStatisticsParams) {
    const p: Record<string, string | string[]> = {};
    if (params?.pwa_ids?.length) {
      p["pwa_ids"] = params.pwa_ids.map(String);
    }
    if (params?.start_date) p.start_date = params.start_date;
    if (params?.end_date) p.end_date = params.end_date;
    if (params?.page !== undefined) p.page = String(params.page);
    if (params?.limit !== undefined) p.limit = String(params.limit);

    const res = await pwaFlowFetch<SuccessWrapper<PwaFlowStatisticsData>>(
      "/api/v1/statistics",
      Object.keys(p).length > 0 ? p : undefined,
    );
    return res.data;
  }
}

// ── Singleton export ────────────────────────────────────────────────────────

export const pwaflowService = new PwaFlowService();
