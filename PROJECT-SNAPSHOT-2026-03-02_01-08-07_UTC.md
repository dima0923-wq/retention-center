# Project Snapshot — Retention Center
**Created**: 2026-03-02 01:08:07 UTC
**Session summary**: Added full delete capability for campaigns (force delete any status) and sequences (hard delete replacing soft archive), plus sequence delete UI

## Current State
- **Production**: Deployed and running at `https://ag2.q37fh758g.click`
- **Service**: `retention-center.service` — active
- **Server**: `38.180.64.126` at `/opt/retention-center/`
- **Stack**: Next.js 16 + Tailwind + shadcn/ui + Prisma 7 + SQLite
- **Auth**: Integrated with Auth Center (ag4) via `ac_access` cookie SSO
- **Latest commit**: `29affa0` — `feat: full delete for campaigns (force) and sequences (hard delete)`

## Work Done This Session

### 1. Campaign Force Delete (any status)
- Removed guards blocking deletion of ACTIVE and COMPLETED campaigns
- Added `force` parameter to `CampaignService.delete(id, force)`
- When `force=true`: skips status checks, auto-cancels pending contact attempts, nulls Keitaro mappings
- When `force=false`: preserves original behavior (blocks ACTIVE/COMPLETED)
- API: `DELETE /api/campaigns/{id}?force=true`

### 2. Sequence Hard Delete (replacing soft archive)
- Changed `RetentionSequenceService.delete()` from soft-delete (set status=ARCHIVED) to true `prisma.retentionSequence.delete()`
- Prisma cascades handle all cleanup: SequenceStep, SequenceEnrollment, SequenceStepExecution (all onDelete: Cascade)
- ZapierWebhookConfig.autoEnrollSequenceId and Webhook.sequenceId auto-nulled (onDelete: SetNull)
- Works on ANY status (DRAFT, ACTIVE, PAUSED, ARCHIVED)

### 3. Sequence Delete UI
- Added Trash2 delete button to `SequenceCard.tsx` (visible for all statuses)
- Added confirmation dialog to `sequences/page.tsx` with ACTIVE status warning
- Matches exact pattern from campaign delete UI (CampaignCard + campaigns page)

## Files Changed

| File | Change |
|------|--------|
| `src/services/campaign.service.ts` | Added `force` param to `delete()`, removed ACTIVE/COMPLETED guards when force=true, added Keitaro mapping cleanup |
| `src/app/api/campaigns/[id]/route.ts` | DELETE handler reads `?force=true` query param |
| `src/services/retention-sequence.service.ts` | Changed from `update(status: ARCHIVED)` to `prisma.retentionSequence.delete()` |
| `src/components/sequences/SequenceCard.tsx` | Added Trash2 button + `onDelete` prop |
| `src/app/(dashboard)/sequences/page.tsx` | Added delete dialog, state, handler matching campaign pattern |

## Architecture & Key Decisions
- **Campaign force delete defaults to false** for backward compatibility — existing UI passes no param (safe), Hermes passes `force=true`
- **Sequence delete is always hard** — no soft-delete option. Prisma cascades handle all child records automatically, no manual cleanup needed
- **No new permissions** — reuses existing `retention:campaigns:delete` permission for both campaigns and sequences

## Deploy Status
- Deployed via `deploy.sh` at 2026-03-02 ~01:06 UTC
- `next build` succeeded, service restarted, status: active
- No data loss (SQLite DB in `data/` excluded from rsync)

## Known Issues & Next Steps
- Campaign delete UI still blocks COMPLETED status at UI level (button hidden) — could update to show for all statuses since backend now supports force
- No bulk delete endpoint yet (delete multiple campaigns/sequences at once)
- Hermes integration: delete tools registered (see Hermes snapshot)
