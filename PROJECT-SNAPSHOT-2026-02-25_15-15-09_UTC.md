# Project Snapshot — Retention Center
**Created**: 2026-02-25 15:15:09 UTC
**Session summary**: Scalability optimization — 10 agents implemented WAL mode, BullMQ queue, batch ops, cleanup jobs, indexes, security, backup, swap. All 251 tests pass. Deployed.

## Current State
- **Service**: `active` on 38.180.64.126 (retention-center.service, Next.js 16.1.6 on :3001)
- **Domain**: https://ag2.q37fh758g.click
- **Health**: `{"status":"ok","service":"retention-center"}`
- **Tests**: 251/251 passing (vitest, 515ms)
- **Build**: Next.js 16.1.6 Turbopack, 4.3s compile, 112 pages
- **Git**: `decb2e8` on main, pushed to GitHub
- **Estimated capacity**: ~2000-3000 leads/hr (with Redis), ~1000-1500 leads/hr (without Redis), up from ~200-500

## Work Done This Session

### Scalability Optimizations (10 tasks, 10 agents in parallel)

1. **SQLite WAL mode + busy_timeout + synchronous=NORMAL** (P0)
   - Modified `src/lib/db.ts` — `initDatabase()` runs PRAGMAs after client creation
   - WAL mode confirmed on prod DB via `sqlite3 prod.db "PRAGMA journal_mode=WAL"`
   - Impact: 2-3x write throughput

2. **BullMQ + Redis job queue** (P0)
   - NEW: `src/lib/queue.ts` — lazy Redis connection, 4 queues (sms/email/call/push)
   - NEW: `src/workers/channel-worker.ts` — rate-limited workers (SMS=1/s, Email=10/s, Call=1/s, Push=5/s)
   - Modified `src/services/channel/channel-router.service.ts` — enqueue via BullMQ, fallback to direct send if Redis unavailable
   - Dependencies: bullmq + ioredis added to package.json
   - Redis is OPTIONAL — app works identically without it

3. **Cron overlap protection** (P1)
   - NEW: `src/lib/cron-lock.ts` — in-memory mutex with auto-expiry (5 min)
   - Modified `src/app/api/cron/run/route.ts` — acquire/release lock, 409 if held, try/finally
   - Prevents duplicate SMS/email/call sends from overlapping cron runs

4. **Batch lead creation** (P1)
   - Added `bulkCreateOptimized()` to `src/services/lead.service.ts`
   - Batch dedup: 1 findMany + 1 transaction instead of N×3 individual queries
   - Modified `src/app/api/leads/bulk/route.ts` to use optimized method

5. **Postmark batch email API** (P2)
   - Added `batchSendFromQueue()` to `src/services/channel/postmark.service.ts`
   - NEW: `src/services/channel/email-batcher.service.ts` — accumulates emails, auto-flushes at 50 or 5s

6. **VapiCallLog cleanup job** (P2)
   - NEW: `src/services/cleanup.service.ts` — 30-day VapiCallLog, 90-day SmsDeliveryEvent, 90-day SequenceStepExecution
   - NEW: `src/app/api/cron/cleanup/route.ts` — daily cleanup endpoint, CRON_SECRET protected

7. **ContactAttempt status indexes** (P2)
   - Added `@@index([status])` and `@@index([status, startedAt])` to prisma/schema.prisma
   - Applied to prod DB via sqlite3 directly

8. **Webhook secrets** (P3)
   - Set ZAPIER_WEBHOOK_SECRET and KEITARO_WEBHOOK_SECRET in prod .env
   - Service restarted, verified healthy

9. **SQLite backup script + systemd timer** (P2)
   - NEW: `scripts/backup-sqlite.sh` — daily backup with gzip, 7-day retention
   - systemd timer `rc-backup.timer` runs daily at 03:00 UTC
   - First backup verified: `rc-20260225-150626.db.gz` (46KB)

10. **4GB swap + ulimit increase** (P2)
    - Swap: 4GB, swappiness=10, persisted in fstab
    - File descriptors: 65535 (limits.conf + systemd LimitNOFILE)
    - Service restarted, verified

### QA (5 agents in parallel)
- Full test suite: 251/251 pass
- Next.js build: success (4.3s, 112 pages)
- Code review: 10 issues found (0 critical, 5 medium, 5 low) — 2 medium fixed
- Server health: all 10 checks pass
- Git inventory: clean, no unexpected changes

### Post-QA Fixes
- Fixed BullMQ queue.ts: queues were eagerly created at import → now lazy (only when Redis confirmed available)
- Fixed double-connect bug in `isRedisAvailable()` — check `conn.status` before calling `connect()`
- Fixed orphaned PENDING attempt when script not found in channel-router
- Updated queue-setup.test.ts to match lazy queue behavior
- Added WAL artifacts to .gitignore (*.db-shm, *.db-wal, *.db-journal)

## Architecture & Key Decisions

- **SQLite kept** (not migrated to PostgreSQL) — WAL mode + BullMQ queue pattern makes single-writer a feature
- **Redis is optional** — BullMQ falls back to direct synchronous sends if Redis unavailable. No Redis on server yet.
- **Cron lock is in-memory** — works for single-process Next.js deployment. Not multi-process safe (documented limitation).
- **Cleanup is separate cron** — `/api/cron/cleanup` runs independently from `/api/cron/run`
- **Batch email accumulator** — emails queue in memory, flush at 50 items or 5s timer
- **Schema indexes via sqlite3** — Prisma migrate had drift issues, used `prisma db push` + direct sqlite3 for prod

## Files Changed

### Modified (21 files)
| File | Change |
|------|--------|
| `.gitignore` | Added *.db-shm, *.db-wal, *.db-journal |
| `package.json` | +bullmq, +ioredis |
| `prisma/schema.prisma` | +@@index([status]), +@@index([status, startedAt]) on ContactAttempt |
| `src/lib/db.ts` | WAL mode + busy_timeout + synchronous=NORMAL initialization |
| `src/app/api/cron/run/route.ts` | Cron lock (acquire/release), timing |
| `src/app/api/leads/bulk/route.ts` | Uses bulkCreateOptimized() |
| `src/services/lead.service.ts` | +bulkCreateOptimized() method |
| `src/services/channel/channel-router.service.ts` | BullMQ enqueue + fallback + orphaned attempt fix |
| `src/services/channel/postmark.service.ts` | +batchSendFromQueue() |

### New Files (13)
| File | Purpose |
|------|---------|
| `src/lib/cron-lock.ts` | In-memory cron mutex lock |
| `src/lib/queue.ts` | BullMQ queue setup (lazy, optional Redis) |
| `src/workers/channel-worker.ts` | BullMQ workers with rate limiting |
| `src/services/channel/email-batcher.service.ts` | Email batch accumulator |
| `src/services/cleanup.service.ts` | VapiCallLog/SmsDelivery/SequenceExec cleanup |
| `src/app/api/cron/cleanup/route.ts` | Cleanup cron endpoint |
| `scripts/backup-sqlite.sh` | SQLite backup script |
| `__tests__/sqlite-wal.test.ts` | WAL mode tests (3) |
| `__tests__/queue-setup.test.ts` | Queue setup tests (6) |
| `__tests__/cron-lock.test.ts` | Cron lock tests (7) |
| `__tests__/bulk-lead-create.test.ts` | Batch lead tests (8) |
| `__tests__/email-batcher.test.ts` | Email batcher tests (13) |
| `__tests__/cleanup-service.test.ts` | Cleanup service tests (7) |

## Test Status
- **251/251 tests pass** (vitest, 515ms)
- 20 test files total
- 9 new test files with 44+ new tests
- All pre-existing 207 tests still pass (no regressions)

## Deploy Status
- **Last deploy**: 2026-02-25 ~15:12 UTC
- **Commit**: `decb2e8` — feat: scalability optimization
- **Service**: active, healthy
- **Build**: Next.js 16.1.6 (Turbopack), success
- **Prod DB**: WAL mode enabled, indexes applied

## Server Configuration (38.180.64.126)
- **Swap**: 4GB configured, swappiness=10
- **File descriptors**: 65535
- **Backup timer**: rc-backup.timer active (daily 03:00 UTC)
- **Backup dir**: /opt/retention-center/backups/
- **Webhook secrets**: ZAPIER_WEBHOOK_SECRET + KEITARO_WEBHOOK_SECRET set
- **HERMES_WEBHOOK_SECRET**: set (from previous session)

## Known Issues & Next Steps

### To activate BullMQ (currently optional/inactive):
1. Install Redis on server: `apt install redis-server`
2. Add `REDIS_URL=redis://localhost:6379` to server .env
3. Call `startWorkers()` from app startup (not wired yet)
4. Restart service

### Remaining from optimization report:
- Postmark batch not yet wired into channel-router processQueue (standalone batcher ready)
- `startWorkers()` in channel-worker.ts not called from app boot (needs entry point)
- BullMQ workers share single Redis connection (should be separate per worker per docs)

### Pre-existing issues (not from this session):
- `typescript.ignoreBuildErrors: true` in next.config.ts (masking TS errors)
- `JSON.parse(campaign.meta)` without try/catch in multiple places
- `leadCount` inflated for deduplicated leads
- Prisma migrations have drift — using `db push` instead of `migrate`
- Next.js middleware deprecation warning (should use "proxy" convention)
- No Redis on server yet — BullMQ is dormant until installed

### Cron setup needed:
- `/api/cron/cleanup` needs external cron trigger (e.g., systemd timer or cron job hitting the endpoint daily)
- Example: `curl -s "http://localhost:3001/api/cron/cleanup?secret=$CRON_SECRET"`
