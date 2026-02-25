# Project Snapshot — Retention Center
**Created**: 2026-02-25 12:24:42 UTC
**Session summary**: Built and deployed configurable multi-webhook system (Zapier + Facebook Lead Ads + Generic) with full UI, 3 rounds of QA (15 agents total), fixed critical webhookId storage bug and FB batching bug

## Current State
- **Status**: PRODUCTION — fully deployed and working
- **URL**: https://ag2.q37fh758g.click
- **Webhooks page**: https://ag2.q37fh758g.click/webhooks
- **Service**: `retention-center.service` — active and healthy
- **All tests passing**: 207/207 (including 98 webhook-specific tests)

## Work Done This Session

### Feature: Multi-Webhook System (10 agents, 2 teams)
Built a complete configurable webhook system supporting Zapier, Facebook Lead Ads, and Generic webhooks.

**Database:**
- New `Webhook` model: id, name, slug (unique), type, sourceLabel, isActive, verifyToken, pageAccessToken, config (JSON), campaignId, sequenceId, fieldMapping (JSON), lastReceivedAt, leadCount, timestamps
- Added `webhookId` (optional) to `Lead` model with relation to `Webhook`
- Added `webhooks` reverse relation to `Campaign` and `RetentionSequence`
- Added "WEBHOOK" to `AutoAssignConfig.sources` type union
- Schema synced via `prisma db push` (not migration — existing drift)

**Backend Service** (`src/services/webhook.service.ts`):
- Full CRUD: list, getById, getBySlug, create, update, delete
- Dynamic inbound processing for all 3 types (zapier/facebook/generic)
- Facebook Graph API lead fetching with fallback to inline field_data
- Facebook batched events: iterates ALL entry[].changes[] (not just first)
- Field mapping: explicit mapping + auto-detection of common field names
- full_name/name splitting into firstName + lastName
- Auto-routing to campaigns + sequence enrollment
- Stats tracking (lastReceivedAt, leadCount increment)
- Unique 8-char slug generation with collision retry

**API Routes:**
- `GET/POST /api/webhooks/config` — list + create
- `GET/PATCH/DELETE /api/webhooks/config/[id]` — single webhook CRUD
- `GET /api/webhooks/config/[id]/activity` — recent leads (limit param, 1-100)
- `POST /api/webhooks/config/[id]/test` — simulate test lead
- `GET /api/webhooks/inbound/[slug]` — Facebook verification handshake
- `POST /api/webhooks/inbound/[slug]` — receive leads (all types, public endpoint)
- Auth: config routes require `retention:templates:manage` permission; inbound routes are public

**Frontend UI:**
- `/webhooks` page: table with type badges, click-to-copy URL, active toggle, search, CRUD dialogs
- `/webhooks/[id]` page: detail view with stats cards (today/week/month), activity log, edit/delete
- `webhook-form.tsx`: create/edit dialog with field mapping editor, preset buttons (Facebook/Zapier), Facebook-specific fields
- `webhook-activity.tsx`: recent leads table with status badges
- Info button with setup instructions for all 3 webhook types
- Sidebar: "Webhooks" item added between Integrations and PWA

### QA Round 1 (5 agents)
- Service logic: fixed empty fieldMapping auto-detection bug
- API routes: fixed redundant DB lookups (3→1 per request)
- Frontend: all 10 checks passed, minor dead code cleanup
- Tests: 207/207 all passing
- Live smoke test: all 9 endpoints verified

### QA Round 2 — E2E (5 agents)
Critical bugs found and fixed:
1. **webhookId not stored in DB** — LeadService.create() didn't accept/pass webhookId. Fixed in types, service, and dedup path
2. **Facebook batched events dropped** — only first entry processed. Now iterates all
3. **full_name not split** — "John Smith" went entirely into firstName. Now splits properly
4. **getActivity() used fragile meta string search** — changed to proper `webhookId` relation query

### Bug Fixes
- `<SelectItem value="">` crash — Radix UI doesn't allow empty string values, use "none" sentinel
- `AutoAssignConfig.sources` type missing "WEBHOOK"
- `WebhookUpdateInput.verifyToken/pageAccessToken` null vs undefined mismatch
- Non-nullable Prisma fields (sourceLabel, config, fieldMapping) assigned null instead of defaults

## Architecture & Key Decisions

### Webhook URL Format
`https://ag2.q37fh758g.click/api/webhooks/inbound/{8-char-slug}`

Each webhook gets a unique slug. One URL handles both verification (GET) and lead ingestion (POST). The slug lookup determines the webhook type and config.

### Field Mapping
Two modes:
1. **Explicit mapping** — JSON object `{ "incoming_field": "leadField" }` configured per webhook
2. **Auto-detection** — if no mapping configured, scans for common field names (email, phone, first_name, full_name, etc.)

### Facebook Safety
POST handler ALWAYS returns 200 to Facebook, even on errors. Facebook disables webhooks that return non-200 repeatedly.

### Lead Source Tracking
- `Lead.source` = webhook's `sourceLabel` (e.g., "ZAPIER_IT_LEADS", "FB_MAIN")
- `Lead.webhookId` = foreign key to Webhook record
- `Lead.meta` = raw original payload preserved as JSON

## Files Changed

### New Files
| File | Description |
|------|-------------|
| `src/services/webhook.service.ts` | Webhook business logic (565+ lines) |
| `src/app/api/webhooks/config/route.ts` | List + create API |
| `src/app/api/webhooks/config/[id]/route.ts` | Get/update/delete API |
| `src/app/api/webhooks/config/[id]/activity/route.ts` | Activity log API |
| `src/app/api/webhooks/config/[id]/test/route.ts` | Test webhook API |
| `src/app/api/webhooks/inbound/[slug]/route.ts` | Inbound receiver (public) |
| `src/app/(dashboard)/webhooks/page.tsx` | Webhooks list page |
| `src/app/(dashboard)/webhooks/[id]/page.tsx` | Webhook detail page |
| `src/components/webhooks/webhook-form.tsx` | Create/edit dialog |
| `src/components/webhooks/webhook-list.tsx` | Webhook table component |
| `src/components/webhooks/webhook-activity.tsx` | Activity log component |
| `src/components/ui/switch.tsx` | shadcn Switch (was missing) |
| `__tests__/webhooks/webhook-service.test.ts` | 44 service tests |
| `__tests__/webhooks/webhook-api.test.ts` | 18 API tests |
| `__tests__/webhooks/webhook-inbound.test.ts` | 16 inbound tests |
| `__tests__/webhooks/webhook-facebook.test.ts` | 20 Facebook tests |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added Webhook model, webhookId on Lead |
| `src/lib/validators.ts` | Added webhook schemas, WEBHOOK to source enums |
| `src/types/index.ts` | Added WEBHOOK to AutoAssignConfig, webhookId to LeadCreateInput |
| `src/services/lead.service.ts` | Accept and store webhookId, update on dedup |
| `src/components/layout/sidebar.tsx` | Added Webhooks nav item |

## Test Status
- **Total**: 207 tests across 14 files — ALL PASSING
- **Webhook tests**: 98 tests across 4 files — ALL PASSING
- **Framework**: Vitest
- **Run command**: `npx vitest run --reporter=verbose`

## Deploy Status
- **Last deploy**: 2026-02-25 ~12:20 UTC
- **Build**: `next build` (Turbopack) — compiles clean, no TS errors
- **Service**: `retention-center.service` — active
- **DB**: Schema synced via `prisma db push` (Webhook table + Lead.webhookId column created)
- **Git**: All commits pushed to `origin/main`

### Git Commits This Session
1. `ef795cb` — feat: add configurable multi-webhook system
2. `672a893` — fix: add WEBHOOK to AutoAssignConfig sources type
3. `beb85a9` — fix: allow null for verifyToken/pageAccessToken
4. `f49534e` — fix: use proper defaults for non-nullable Prisma fields
5. `251331e` — fix: QA fixes + add setup instructions info button
6. `9feee08` — fix: use sentinel value for empty Select options (Radix UI crash)
7. `68b4c06` — fix: critical webhook E2E bugs — webhookId storage, FB batching, name splitting

## Known Issues & Next Steps
1. **Stats inconsistency**: Deduplicated leads increment webhook's `leadCount` but detail page time-based stats only count non-dedup leads (minor UI cosmetic)
2. **Webhook config routes require auth** — external tools (Zapier/FB) use the public inbound endpoint, but management API needs auth cookie or x-service-key header
3. **No webhook signature validation for Zapier** — Zapier doesn't sign payloads, so anyone with the URL can send leads. Consider rate limiting or IP whitelisting
4. **Legacy endpoints still active** — `/api/webhooks/meta` and `/api/webhooks/zapier-leads` still work alongside new system. Consider migrating or deprecating
5. **Production DB uses `prisma db push`** — no migration files. Future schema changes need `db push` on server too

## Server & Service Info
- **Server**: 38.180.64.126
- **SSH**: Key auth only (password disabled)
- **Domain**: https://ag2.q37fh758g.click
- **Server path**: `/opt/retention-center/`
- **DB**: `/opt/retention-center/prod.db` (SQLite)
- **Service**: `retention-center.service` (Next.js on :3001, nginx proxy)
- **Deploy**: `./deploy.sh` from `/Users/sky/retention-center/`
- **Health**: `https://ag2.q37fh758g.click/api/health`
- **Service key**: `sk-svc-ag2-****` (in server .env as SERVICE_API_KEY)
