// PwaFlow API types — derived from Swagger spec at /docs/pwaflow-api-swagger.json

// ── Pagination ──────────────────────────────────────────────────────────────

export type PwaFlowPaginationMeta = {
  page: number;
  limit: number;
  total: number; // total pages
};

// ── Attachment / Screenshot ─────────────────────────────────────────────────

export type PwaFlowAttachmentFile = {
  url: string;
  signed_id: string;
};

export type PwaFlowScreenshotFile = {
  id: number;
  url: string;
  signed_id: string;
};

// ── PWA Comment ─────────────────────────────────────────────────────────────

export type PwaFlowComment = {
  id?: number;
  author?: string | null;
  date?: string | null;
  rating?: number | null;
  likes?: number | null;
  comment?: string | null;
  reply_author?: string | null;
  reply_date?: string | null;
  reply_comment?: string | null;
  status?: string | null;
  avatar?: PwaFlowAttachmentFile | null;
};

// ── PWA Language ────────────────────────────────────────────────────────────

export type PwaFlowLanguage = {
  id?: number;
  lang?: string;
  status?: string;
  name?: string | null;
  dev_name?: string | null;
  downloads?: number | null;
  age?: number | null;
  description?: string | null;
  tags?: string[];
  rating?: number | null;
  reviews_count?: number | null;
  txt_whats_new?: string | null;
  website_url?: string | null;
  developer_address?: string | null;
  privacy_policy_url?: string | null;
  developer_email?: string | null;
  icon?: PwaFlowAttachmentFile | null;
  screenshots?: PwaFlowScreenshotFile[];
  comments?: PwaFlowComment[];
};

// ── PWA ─────────────────────────────────────────────────────────────────────

export type PwaFlowPwa = {
  id?: number;
  company_id?: number;
  name?: string;
  naming?: string | null;
  default_lang?: string | null;
  active?: boolean;
  archived?: boolean;
  push_enabled?: boolean;
  white_page_type?: number | null;
  white_page_url?: string | null;
  loading_time?: number | null;
  landing_type?: string | null;
  domain_id?: number | null;
  countries?: string[];
  platforms_ids?: string[];
  bot_check?: boolean;
  pwa_reach_ui?: boolean;
  open_offer_for_in_app_browsers?: boolean;
  turn_on_adm_smart_pixel?: boolean;
  pixel_countries?: string[];
  pixel_cities?: string[];
  track_key_ids?: number[];
  languages?: PwaFlowLanguage[];
};

// ── Domain ──────────────────────────────────────────────────────────────────

export type PwaFlowDomain = {
  id?: number;
  company_id?: number;
  url?: string;
  parent_id?: number | null;
  pwa_id?: number | null;
  domain_split_id?: number | null;
  shared_company_ids?: number[];
  wildcard_certificate_present?: boolean;
  total_opens?: number;
};

// ── Meta Pixel ──────────────────────────────────────────────────────────────

export type PwaFlowMetaPixel = {
  id?: number;
  company_id?: number;
  name?: string;
  fbp?: string | null;
  fbat?: string | null;
};

// ── Push Message ────────────────────────────────────────────────────────────

export type PwaFlowPushMessage = {
  id?: number;
  lang?: string;
  title?: string;
  body?: string;
  image?: PwaFlowAttachmentFile | null;
};

// ── Push Schedule ───────────────────────────────────────────────────────────

export type PwaFlowPushSchedule = {
  id?: number;
  schedule_type?: string;
  time?: string | null;
  delay_duration?: number | null;
  days?: string[];
  repeat?: boolean;
  position?: number;
};

// ── Push ────────────────────────────────────────────────────────────────────

export type PwaFlowPush = {
  id?: number;
  company_id?: number;
  name?: string;
  default_lang?: string | null;
  active?: boolean;
  archived?: boolean;
  event_id?: string | null;
  custom_click_url?: string | null;
  custom_audience_user_ids?: string[];
  pwa_ids?: number[];
  messages?: PwaFlowPushMessage[];
  schedules?: PwaFlowPushSchedule[];
};

// ── Statistics ──────────────────────────────────────────────────────────────

export type PwaFlowStatisticsMetricObject = Record<string, number>;

export type PwaFlowStatisticsMetricDeltaRow = {
  key?: string;
  unique?: number;
  unique_previous?: number;
  unique_delta_percent?: number;
  total?: number;
  total_previous?: number;
  total_delta_percent?: number;
  type?: string;
};

export type PwaFlowStatisticsUser = {
  id?: string;
  created_at?: string | null;
  ip?: string | null;
  pwa_id?: number | null;
  country?: string | null;
  is_bot?: boolean | null;
  is_white_page?: boolean | null;
  is_pwa?: boolean | null;
  os_name?: string | null;
  nav_url?: string | null;
  params?: string | null;
};

export type PwaFlowStatisticsData = {
  range?: { start: string; end: string };
  previous_range?: { start: string; end: string };
  stats_source?: "hourly" | "daily" | "hybrid";
  events?: PwaFlowStatisticsMetricObject;
  events_previous?: PwaFlowStatisticsMetricObject;
  events_table?: PwaFlowStatisticsMetricDeltaRow[];
  push?: PwaFlowStatisticsMetricObject;
  push_previous?: PwaFlowStatisticsMetricObject;
  push_table?: PwaFlowStatisticsMetricDeltaRow[];
  pixel?: PwaFlowStatisticsMetricObject;
  pixel_previous?: PwaFlowStatisticsMetricObject;
  pixel_table?: PwaFlowStatisticsMetricDeltaRow[];
  users?: PwaFlowStatisticsUser[];
  users_meta?: PwaFlowPaginationMeta;
};

// ── API Response Wrappers ───────────────────────────────────────────────────

export type PwaFlowApiError = {
  error: string;
  message?: string | string[];
};

export type PwaFlowSuccessResponse<T> = {
  result: "success";
  data: T;
};

export type PwaFlowErrorResponse = {
  result: "error";
  error: PwaFlowApiError;
};

export type PwaFlowListParams = {
  page?: number;
  limit?: number;
  archived?: boolean;
};

export type PwaFlowStatisticsParams = {
  pwa_ids?: number[];
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
};
