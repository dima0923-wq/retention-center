# Project Snapshot — Retention Center
**Created**: 2026-02-25 01:18:04 UTC
**Session summary**: Added hourly self-learning conversion rules update to cron job; reviewed Self-Learning Dashboard architecture

## Current State
- **Service**: `retention-center.service` — ACTIVE on server `38.180.64.126`
- **Domain**: https://ag2.q37fh758g.click
- **Health**: `/api/health` returning `{"status":"ok"}`
- **Stack**: Next.js 16 + Tailwind + shadcn/ui + Prisma 7 + SQLite
- **Auth**: Integrated with Auth Center (ag4) via `ac_access` cookie SSO

## Work Done This Session

### 1. Self-Learning Dashboard Review
- Reviewed the full Self-Learning Dashboard (`/learning` route)
- Dashboard is **fully wired to real data** via `LearningService` (not mock)
- Components: ConversionHeatmap, WordPerformance, SequencePerformance, ChannelMixChart, RecommendedActions, ABTestCard, InsightCard
- 8 API routes under `/api/learning/` — all auth-protected with `retention:analytics:view` permission
- Statistical analysis includes z-tests for word performance confidence

### 2. Hourly Conversion Rules Cron (NEW)
- Added `LearningService.updateConversionRules()` to existing cron endpoint `/api/cron/run`
- Throttled to run **once per hour** using in-memory timestamp (cron fires every ~15s)
- Returns `{ skipped: true, nextRunIn: "Xm" }` between runs
- First run after service restart executes immediately
- File changed: `src/app/api/cron/run/route.ts`

## Architecture & Key Decisions
- **Cron strategy**: Reused existing `/api/cron/run` endpoint + `retention-cron.timer` (systemd) rather than adding a separate timer
- **Hourly throttle**: In-memory `lastConversionRulesUpdate` timestamp — simple, no DB overhead, resets on restart (acceptable since first run is immediate)
- **ConversionRule table**: Stores statistically significant word-based and time-slot rules with confidence scores. Full delete+recreate on each update cycle.

## Files Changed (Uncommitted)
| File | Change |
|------|--------|
| `src/app/api/cron/run/route.ts` | Added LearningService import + hourly conversion rules update (step #6) |
| `src/app/(dashboard)/campaigns/[id]/page.tsx` | Campaign detail page improvements (prior session) |
| `src/app/(dashboard)/campaigns/page.tsx` | Campaigns list page improvements (prior session) |
| `src/app/(dashboard)/page.tsx` | Dashboard page improvements (prior session) |
| `src/components/campaigns/CampaignCard.tsx` | Campaign card component updates (prior session) |
| `src/services/campaign.service.ts` | Campaign service fixes (prior session) |

## Self-Learning Dashboard Components
- **Page**: `src/app/(dashboard)/learning/page.tsx`
- **Service**: `src/services/learning.service.ts` (860 lines — analyzeConversions, getTopPerformingWords, suggestOptimalScript, getConversionFunnel, generateInsights, getTimeAnalysis, updateConversionRules, getSequencePerformance, getChannelMixAnalysis, getRecommendations)
- **API Routes**: `/api/learning/{recommendations,heatmap,channel-mix,sequence-performance,funnel,insights,suggestions,words}`
- **Components**: `src/components/learning/{RecommendedActions,ChannelMixChart,SequencePerformance,ConversionHeatmap,WordPerformance}.tsx`

## Cron Jobs (All in `/api/cron/run`)
1. Process scheduled contacts (SchedulerService)
2. Process retention sequences (SequenceProcessorService)
3. Process pending contact queue (ChannelRouterService)
4. Batch-score stale leads (LeadScoringService)
5. Sync VAPI calls (VapiSyncService)
6. **NEW**: Update conversion rules — hourly (LearningService)

## Deploy Status
- **Server**: `38.180.64.126` — service active, healthy
- **Last deploy**: Prior session (not deployed this session yet)
- **Uncommitted changes**: 6 files (295 insertions, 28 deletions)
- **Deploy script**: `/Users/sky/retention-center/deploy.sh`

## Known Issues & Next Steps
- `updateConversionRules()` is now auto-triggered but **nothing consumes the ConversionRule table yet** for actual scheduling/routing decisions (noted in `docs/business-analysis.md`)
- Dashboard shows zeros until sufficient campaign data flows through the system
- Uncommitted campaign page improvements from prior session need review + deploy
