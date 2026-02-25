# Project Snapshot — Retention Center
**Created**: 2026-02-25 01:18:17 UTC
**Session summary**: Added campaign delete functionality (all non-completed statuses), combined PostMark + Instantly email stats on dashboard, fixed PostMark auth, cleaned test data

## Current State
- **Production**: https://ag2.q37fh758g.click — service **active**, healthy
- **Server**: 38.180.64.126, Ubuntu, uptime 6+ days
- **Service**: `retention-center.service` (Next.js on :3001)
- **DB**: SQLite at `/opt/retention-center/prod.db`

## Stack
- Next.js 16 + Tailwind + shadcn/ui + Prisma 7 + SQLite
- Auth: Integrated with Auth Center (ag4) via SSO cookies + JWT
- Email providers: Instantly.ai + PostMark (both configured + active)
- Voice: VAPI integration for CALL campaigns
- Webhooks: Zapier + PostMark webhook handlers

## Work Done This Session

### 1. Delete Campaign Button (Frontend + Backend)
- **Backend** (`src/services/campaign.service.ts`): Changed delete guard from DRAFT-only to blocking only COMPLETED campaigns
- **Detail page** (`src/app/(dashboard)/campaigns/[id]/page.tsx`): Added red "Delete" button with Trash2 icon, confirmation dialog, stronger warning for ACTIVE/PAUSED campaigns
- **List page** (`src/app/(dashboard)/campaigns/page.tsx`): Added delete handler + confirmation dialog, refreshes list after deletion
- **CampaignCard** (`src/components/campaigns/CampaignCard.tsx`): Added optional `onDelete` prop, trash icon for non-COMPLETED campaigns
- Cascade deletes handled by Prisma (CampaignLead, ABTest, ZapierConfig cascade; Scripts/ContactAttempts/Conversions set to null)

### 2. PostMark Stats on Campaign Detail Page
- Added PostMark stats card showing: Sent, Opens, Clicks, Bounced, Spam (with percentages)
- Fetches from `/api/integrations/postmark/stats`
- Refresh button for on-demand stats pull
- Only shows for EMAIL channel campaigns

### 3. Fixed PostMark Stats Auth Bug
- **Bug**: `credentials: "include"` was missing from PostMark fetch calls — auth cookie not sent, API returned 401 silently
- **Fix**: Added `{ credentials: "include" }` to both fetch calls (initial load + refresh button)

### 4. Combined Email Stats on Dashboard
- Dashboard now fetches both Instantly (`/api/instantly/analytics`) and PostMark (`/api/integrations/postmark/stats`) stats
- "Total Emails Sent" shows combined total with "Instantly: X · PostMark: Y" subtitle
- Open Rate and Bounce Rate show per-provider breakdown when PostMark data exists
- Reply Rate shows Instantly only (PostMark doesn't track replies)
- "Instantly + PostMark" badge appears when both sources have data

### 5. Removed "Instantly Connected" Badge from Dashboard
- Removed `instantlyConnected` state, setter calls, and Connected/Disconnected badge from dashboard header

### 6. Cleaned Test Conversions
- Deleted 3 test Conversion records from prod DB (Feb 19-20, status="lead", $0 revenue, no campaign/channel)
- Conversion count now 0

## Files Changed This Session
| File | Change |
|------|--------|
| `src/services/campaign.service.ts` | Delete guard: DRAFT-only → blocks only COMPLETED |
| `src/app/(dashboard)/campaigns/[id]/page.tsx` | Delete button + PostMark stats card + auth fix |
| `src/app/(dashboard)/campaigns/page.tsx` | Delete handler + combined email stats + removed Instantly badge |
| `src/components/campaigns/CampaignCard.tsx` | Added onDelete prop + trash icon for non-COMPLETED |

## Key Architecture & Integrations
- **Auth**: All API routes use `verifyApiAuth()` + `requirePermission()` — cookies must include `ac_access` token from Auth Center
- **PostMark config**: Stored in `IntegrationConfig` table (provider="postmark", isActive=1), server token `76e0****`, account token `14c5****`
- **Instantly**: API at `https://api.instantly.ai/api/v2`, login admin@ads-welldone.com
- **Campaign status flow**: DRAFT → ACTIVE → PAUSED/COMPLETED. Delete allowed for all except COMPLETED.
- **Permissions**: `retention:campaigns:delete` required for DELETE endpoint

## Deploy Status
- **Last deploy**: 2026-02-25 ~01:15 UTC
- **Method**: `deploy.sh` (rsync + npm install + prisma generate + db push + next build + restart)
- **Service**: active, ready in 887ms on port 3001
- **DB**: prod.db (SQLite), 0 conversions, PostMark integration active

## Known Issues & Next Steps
- PostMark has minimal sending history (1 sent, 1 bounced) — stats will populate as emails are sent
- No campaign-specific PostMark stats (current stats are server-level overview) — would need tag-based filtering
- No tests for campaign deletion or email stats combination
- Email stats dashboard page (`/email-stats`) already has detailed PostMark tab — dashboard main page now has summary view
