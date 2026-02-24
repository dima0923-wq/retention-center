# Retention Center — Project Snapshot (2026-02-24)

## Overview

SMS, email, and call conversion center for automated lead retention campaigns. Part of the Fully Automated Media Buying Platform (Project 3 of 3).

- **Domain**: https://ag2.q37fh758g.click
- **Server**: 38.180.64.126 (Ubuntu, 99GB disk, ~8% used)
- **Server path**: /opt/retention-center/
- **Local path**: /Users/sky/retention-center/
- **GitHub**: dima0923-wq/retention-center (main branch)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript 5.x |
| React | 19.2.3 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | SQLite (Prisma 7.4.0 + @prisma/adapter-libsql) |
| State | Zustand 5.0.11 |
| Forms | react-hook-form 7.71.1 + zod 4.3.6 |
| Charts | Recharts 3.7.0 |
| Auth | JWT (jose 6.1.3) via Auth Center SSO |
| Email | Postmark (primary) + Instantly.ai (fallback) |
| Node.js | v20.20.0 (server) |

---

## Git Status

- **Latest commit**: `02749a4` — "feat: add Zapier FB leads webhook with per-campaign config"
- **Total commits**: 13 on main
- **Last server deploy**: 2026-02-24 (with all new features below)

### Recent Commit History

```
02749a4 feat: add Zapier FB leads webhook with per-campaign config
a7555a6 docs: add complete database architecture documentation
e579e8b docs: add project snapshot 2026-02-21
7e79c6a Fix: API routes return 401 JSON instead of 307 redirect for unauthenticated requests
b830049 Integrate Auth Center: middleware, auth routes, user context, API protection, login/logout flow
18b1bbd Add project folder structure snapshot
1e0c402 Add server state snapshot
1d43268 Add git history snapshot
8c66b5c Full QA audit fix: 87 issues across schema, APIs, services, UI, config
bc5c5d1 Add Test Send page, campaign-level VAPI settings, fix Radix Select bugs
dfd7d4d Full QA pass: fix all channel services, add self-learning engine, Keitaro postbacks, A/B testing, parallel channel execution, contact scheduling
9176acc Add Instantly.ai email integration, deploy script, and campaign meta field
e931da1 Add retention center app: campaigns, leads, scripts, reports, integrations
01eb60d Initial commit from Create Next App
```

---

## Directory Structure

```
retention-center/
  docs/                   # Project documentation
  prisma/                 # Schema + migrations
    migrations/
  public/                 # Static assets
  src/
    app/
      (dashboard)/        # Main dashboard layout (sidebar + header)
        campaigns/        # Campaign management pages
        conversions/      # Conversion tracking pages
        email-templates/  # Email template management pages (NEW)
        integrations/     # Integration config pages
        leads/            # Lead management pages (+ score display)
        learning/         # Self-learning engine pages
        page.tsx          # Dashboard home (stats + charts + lead score distribution)
        reports/          # Reporting pages
        scripts/          # Script management pages
        sequences/        # Retention sequence pages
        test-send/        # Test send page
      api/                # API routes
        campaigns/        # Campaign CRUD API
        contact-attempts/ # Contact attempt API
        conversions/      # Conversion + stats API
        cron/             # Cron endpoint (secret-protected, no auth) (NEW)
        email-templates/  # Email template CRUD API (NEW)
        instantly/        # Instantly.ai proxy API
        integrations/     # Integration config API (+ Postmark, Meta CAPI)
        leads/            # Lead CRUD API (+ scoring endpoints)
        learning/         # Self-learning engine API
        reports/          # Report generation API
        scheduler/        # Scheduler API
        scripts/          # Script CRUD API
        sequences/        # Retention sequence API
        test-send/        # Test send API (+ Postmark test)
        webhooks/         # Webhooks: Keitaro, Meta, Postmark, Instantly, SMS, VAPI, Zapier (public)
        zapier-configs/   # Zapier webhook config CRUD API (NEW)
      auth/               # Auth routes
        callback/         # Auth Center callback page
        logout/           # Server-side logout route
        token/            # Token exchange route
    components/           # UI components
      campaigns/
      email-templates/    # Email template card + form (NEW)
      integrations/       # + PostmarkIntegrationCard, MetaCapiIntegrationCard (NEW)
      layout/             # Sidebar + Header
      leads/              # + LeadTable score column, LeadFilters score filter (NEW)
      learning/
      reports/
      scripts/
      sequences/
      ui/                 # shadcn/ui primitives
    generated/            # Prisma generated client
      prisma/
    lib/                  # Utilities
      api-auth.ts         # Server-side auth verification
      auth.ts             # Client-side auth helpers
      db.ts               # Database connection
      user-context.tsx    # React context for user state
      utils.ts            # General utilities
      validators.ts       # Zod validators (+ scoreLabel)
    services/             # Business logic services (18 total, 6,076 lines)
      channel/            # Channel-specific services
        channel-router.service.ts  (330 lines) — Routes to correct channel, Postmark primary + Instantly fallback
        email.service.ts           (406 lines) — Instantly.ai email integration
        postmark.service.ts        (176 lines) — Postmark email sending (NEW)
        sms.service.ts             (443 lines) — SMS channel integration
        vapi.service.ts            (262 lines) — VAPI voice AI integration
      ab-test.service.ts           (198 lines)
      campaign.service.ts          (425 lines)
      email-template.service.ts    (189 lines) — Email template CRUD (NEW)
      lead-router.service.ts       (180 lines) — Lead routing + auto Postmark email on new lead
      lead-scoring.service.ts      (202 lines) — Score 0-100, labels HOT/WARM/COLD/DEAD/NEW (NEW)
      lead.service.ts              (279 lines) — Lead CRUD + Meta CAPI on creation
      learning.service.ts          (859 lines)
      meta-capi.service.ts         (154 lines) — Meta Conversions API integration (NEW)
      report.service.ts            (463 lines)
      retention-sequence.service.ts (787 lines)
      scheduler.service.ts          (291 lines)
      script.service.ts             (145 lines)
      sequence-processor.service.ts (159 lines)
      zapier-config.service.ts      (128 lines) — Zapier webhook config (NEW)
    types/                # TypeScript type definitions
```

---

## Database Schema (Prisma/SQLite)

### Models (15 total)

| Model | Purpose |
|-------|---------|
| **Lead** | Contact records (name, phone, email, source, status, **score, scoreLabel, scoreUpdatedAt**) |
| **Campaign** | Marketing campaigns (name, channels, dates, status) |
| **CampaignLead** | Many-to-many campaign-lead assignment |
| **Script** | Channel scripts (EMAIL/SMS/CALL) with VAPI config |
| **ContactAttempt** | Individual contact attempt records (channel, status, cost, result) |
| **IntegrationConfig** | Provider configs (Instantly, VAPI, Postmark, Meta CAPI, etc.) |
| **Conversion** | Conversion tracking (revenue, source, Keitaro subId/clickId) |
| **ConversionRule** | Self-learning conversion rules (channel, metric, confidence) |
| **ABTest** | A/B testing framework (variants, stats, winner) |
| **RetentionSequence** | Multi-step retention workflows (trigger, channels) |
| **SequenceStep** | Individual steps in a sequence (channel, delay, conditions) |
| **SequenceEnrollment** | Lead enrollment in sequences (status, progress) |
| **SequenceStepExecution** | Step execution tracking (scheduled, executed, result) |
| **EmailTemplate** | Configurable email templates with variables (NEW) |
| **ZapierWebhookConfig** | Per-campaign Zapier/FB leads webhook config (NEW) |

### Key Relationships

- Lead -> CampaignLead -> Campaign (many-to-many)
- Lead -> ContactAttempt -> Script
- Lead -> SequenceEnrollment -> RetentionSequence -> SequenceStep
- Campaign -> ABTest
- Campaign -> ZapierWebhookConfig (one-to-one)
- ContactAttempt -> Conversion
- SequenceStepExecution -> SequenceEnrollment + SequenceStep + ContactAttempt

### Database File

- **Server**: `/opt/retention-center/prod.db` (SQLite)
- **Local**: Uses `*.db` (excluded from deploy via deploy.sh)

---

## Auth Integration (Auth Center SSO)

The Retention Center is fully integrated with the Auth Center at `https://ag4.q37fh758g.click`.

### Auth Flow

1. **Middleware** (`src/middleware.ts`): Checks for `ac_access` cookie (JWT). If missing:
   - API routes return 401 JSON
   - Page routes redirect to Auth Center login with callback URL
2. **Token route** (`src/app/auth/token/route.ts`): Receives JWT from Auth Center after login
3. **Callback** (`src/app/auth/callback/page.tsx`): Auth Center callback handler
4. **Logout** (`src/app/auth/logout/route.ts`): Server-side logout, clears cookie, redirects to Auth Center

### Public Paths (no auth required)

- `/auth/*` — Auth routes
- `/_next/*` — Next.js assets
- `/api/webhooks/*` — Keitaro/Meta/Postmark/Zapier postback webhooks
- `/api/cron/*` — Cron endpoint (secret token auth instead)
- `/favicon.ico`
- `/api/auth/*` — Auth API routes

---

## Features

### 1. Dashboard (Home Page)
- Overview stats: total leads, active campaigns, conversion rate, contact attempts
- Retention sequence stats: active sequences, enrolled leads, conversion rate, completed
- Email campaign stats (Instantly.ai): total sent, open rate, reply rate, bounce rate
- Conversion stats: total conversions, revenue, conversion rate
- **Lead Score Distribution**: avg score + count per label (HOT/WARM/COLD/DEAD/NEW) (NEW)
- 7-day trend charts: leads + contact activity (Recharts LineChart)
- Upcoming sequence steps + recent sequence activity tables

### 2. Lead Management
- CRUD operations for contacts
- Fields: name, phone, email, source, status, notes, **score, scoreLabel** (NEW)
- **Score column** in leads table: sortable, colored badges (HOT=red, WARM=yellow, COLD=blue, DEAD=gray, NEW=green) (NEW)
- **Score filter** dropdown in lead filters (NEW)
- **Recalculate score** button on lead detail page (NEW)
- Indexed by email, phone, status, score, scoreLabel

### 3. Campaign Management
- CRUD with status workflow (DRAFT -> ACTIVE -> etc.)
- Multi-channel support (EMAIL, SMS, CALL)
- Lead assignment (many-to-many)
- Script association

### 4. Script Management
- Templates for EMAIL, SMS, CALL channels
- VAPI configuration for voice calls
- Campaign-level VAPI settings

### 5. Contact Attempts
- Track every outreach attempt
- Channel routing (email/SMS/call)
- Status tracking, duration, cost, result
- Provider reference tracking

### 6. Retention Sequences
- Multi-step automated workflows
- Trigger types: new_lead, no_conversion, manual
- Steps with configurable delays (hours/days/weeks)
- Channel per step (EMAIL/SMS/CALL)
- Enrollment tracking with status (ACTIVE/PAUSED/COMPLETED/CANCELLED/CONVERTED)
- Step execution scheduling and tracking

### 7. Email Templates (NEW)
- Configurable email templates with template variables ({{firstName}}, {{email}}, etc.)
- CRUD: create, edit, duplicate, preview
- Trigger-based: templates assigned to triggers (e.g., "new_lead")
- Used by Postmark integration for automated emails

### 8. Integrations
- **Postmark** (NEW): Primary email provider — send email, batch send, delivery webhooks, connection test
- **Instantly.ai**: Email sending via API V2 (fallback provider)
- **Meta CAPI** (NEW): Conversions API — sends conversion events back to Meta for ad optimization (SHA256 PII hashing, Graph API v21.0)
- **VAPI**: Voice AI for automated calls
- **SMS**: SMS service integration
- Provider config stored in IntegrationConfig model
- Integration cards on Integrations page with test connection buttons

### 9. Conversions & Keitaro Postbacks
- Conversion tracking with revenue
- Keitaro postback webhooks (subid, status, revenue, clickId)
- **Meta CAPI feedback**: sale → sendConversionEvent, lead + META source → sendLeadEvent (NEW)
- Source tracking (keitaro default)

### 10. Lead Scoring (NEW)
- Score 0-100 based on engagement signals:
  - Email/phone presence, source quality, conversion count
  - Contact attempts, sequence enrollments, lead age
  - Status overrides: CONVERTED=100, DO_NOT_CONTACT=0
- Labels: HOT (80-100), WARM (60-79), COLD (30-59), DEAD (0-29), NEW (no activity)
- Batch scoring via cron (100 leads per run)
- API: GET/POST per-lead score, GET stats, POST batch score

### 11. Cron System (NEW)
- `/api/cron/run` endpoint with secret token auth (`CRON_SECRET` env var)
- Runs 4 jobs: scheduled contacts, sequences, contact queue, lead scoring
- **Systemd timer** on server: runs every 15 seconds for near-instant lead response
- Service: `retention-cron.timer` + `retention-cron.service`

### 12. Zapier/FB Leads Webhook
- Per-campaign Zapier webhook config
- Facebook Lead Ads integration via Zapier
- Auto-assigns leads to campaigns

### 13. A/B Testing
- Campaign-level A/B tests
- Variant comparison with stats
- Winner selection

### 14. Self-Learning Engine
- Conversion rule analysis (channel, metric, confidence)
- Sample size tracking
- Automatic optimization rules

### 15. Reports
- Overview reports with date filtering
- Timeline reports (daily aggregation)
- Channel performance analysis

### 16. Test Send
- Test page for sending individual emails/SMS/calls
- Postmark test email endpoint
- Useful for debugging channel integrations

---

## Server Configuration

### Systemd Services

| Service | Purpose |
|---------|---------|
| `retention-center.service` | Next.js app on port 3001 |
| `retention-cron.timer` | Triggers cron every 15 seconds (NEW) |
| `retention-cron.service` | Oneshot: curls `/api/cron/run` endpoint (NEW) |

### Nginx

- **Config**: `/etc/nginx/sites-enabled/retention-center`
- **SSL**: Let's Encrypt (certbot auto-managed)
- **Proxy**: localhost:3001 with WebSocket upgrade support
- **HTTP->HTTPS**: Auto redirect

### Server Environment (.env)

```
DATABASE_URL="file:./prod.db"
INSTANTLY_API_KEY=placeholder
POSTMARK_API_KEY=14c5b466-db1d-45e1-8d9f-163d16476e25
CRON_SECRET=retention-cron-secret-2026
NEXT_PUBLIC_APP_URL=https://ag2.q37fh758g.click
AUTH_CENTER_URL=https://ag4.q37fh758g.click
PROJECT_ID=retention_center
NEXT_PUBLIC_AUTH_CENTER_URL=https://ag4.q37fh758g.click
```

---

## Deployment

### Deploy Script (`deploy.sh`)

```bash
#!/bin/bash
set -e
rsync -avz \
  -e 'ssh -o StrictHostKeyChecking=no' \
  --exclude='node_modules' --exclude='.next' --exclude='.git' \
  --exclude='.env' --exclude='*.db' --exclude='.DS_Store' \
  --exclude='tsconfig.tsbuildinfo' \
  /Users/sky/retention-center/ root@38.180.64.126:/opt/retention-center/

ssh root@38.180.64.126 '
  cd /opt/retention-center &&
  npm install && npx prisma generate && npx prisma db push &&
  npm run build && systemctl restart retention-center
'
```

### Deploy Procedure

1. Make changes locally
2. Git commit and push to GitHub
3. Run `./deploy.sh` from project root
4. Script rsyncs, installs deps, generates Prisma, builds Next.js, restarts service
5. SSH key auth (no password needed)

---

## Services Architecture (18 services, 6,076 lines total)

| Service | Lines | Purpose |
|---------|-------|---------|
| learning.service.ts | 859 | Self-learning engine, conversion rule analysis |
| retention-sequence.service.ts | 787 | Sequence management, enrollment, step execution |
| report.service.ts | 463 | Report generation, overview/timeline aggregation |
| sms.service.ts | 443 | SMS channel integration |
| campaign.service.ts | 425 | Campaign CRUD, lead assignment |
| email.service.ts | 406 | Instantly.ai email integration |
| channel-router.service.ts | 330 | Route contacts to correct channel (Postmark primary) |
| scheduler.service.ts | 291 | Scheduling logic for automated contacts |
| lead.service.ts | 279 | Lead CRUD + Meta CAPI on creation |
| vapi.service.ts | 262 | VAPI voice AI integration |
| lead-scoring.service.ts | 202 | Score leads 0-100, labels HOT/WARM/COLD/DEAD/NEW |
| ab-test.service.ts | 198 | A/B testing framework |
| email-template.service.ts | 189 | Email template CRUD |
| lead-router.service.ts | 180 | Lead routing + auto Postmark email on new lead |
| postmark.service.ts | 176 | Postmark email sending |
| sequence-processor.service.ts | 159 | Process sequence step executions |
| meta-capi.service.ts | 154 | Meta Conversions API (Graph API v21.0) |
| script.service.ts | 145 | Script template CRUD |
| zapier-config.service.ts | 128 | Zapier webhook config |

---

## API Routes (20+ route groups)

| Route | Purpose |
|-------|---------|
| /api/campaigns | Campaign CRUD + stats + lead assignment |
| /api/contact-attempts | Contact attempt tracking |
| /api/conversions | Conversion CRUD + stats |
| /api/cron/run | Cron endpoint (secret token auth, no user auth) (NEW) |
| /api/email-templates | Email template CRUD + duplicate + preview (NEW) |
| /api/instantly | Instantly.ai proxy (analytics) |
| /api/integrations | Integration config CRUD (+ Postmark, Meta CAPI) |
| /api/leads | Lead CRUD + bulk + stats + scoring (NEW) |
| /api/learning | Self-learning engine API |
| /api/reports | Overview + timeline + channel + campaign reports |
| /api/scheduler | Scheduling API |
| /api/scripts | Script CRUD + duplicate |
| /api/sequences | Retention sequence CRUD + dashboard stats |
| /api/test-send | Test send endpoints (email, SMS, call, Postmark) |
| /api/webhooks/keitaro | Keitaro postback (+ Meta CAPI feedback) |
| /api/webhooks/meta | Meta Lead Ads webhook (+ Meta CAPI lead event) |
| /api/webhooks/postmark | Postmark delivery webhooks (NEW) |
| /api/webhooks/instantly | Instantly.ai webhooks |
| /api/webhooks/zapier-leads | Zapier/FB leads webhook (NEW) |
| /api/zapier-configs | Zapier webhook config CRUD (NEW) |

---

## UI Pages (12 dashboard sections)

1. Dashboard (home) — stats, charts, lead score distribution
2. Campaigns — list, create, edit, lead assignment
3. Leads — list (with score column + filter), detail (with score + recalculate)
4. Scripts — list, create, edit
5. Sequences — list, create, edit, enrollments
6. Email Templates — list, create, edit, duplicate, preview (NEW)
7. Integrations — Postmark, Meta CAPI, Instantly, VAPI, SMS cards
8. Learning — self-learning engine insights
9. Reports — overview, timeline, channel analysis
10. Conversions — conversion tracking
11. Test Send — test email/SMS/call
12. Auth — callback, token, logout

---

## Known Issues / Notes

- `POSTMARK_API_KEY` returns 401 — needs valid Server Token from Postmark dashboard
- `INSTANTLY_API_KEY` is set to `placeholder` on server (not configured for production)
- No VAPI production keys configured
- SMS service exists but no production provider configured
- Meta CAPI requires Pixel ID + Access Token configured via Integrations page
- All API routes (except webhooks and cron) require auth via middleware or return 401

---

## Cross-Project Integration

- **Auth Center** (ag4.q37fh758g.click): SSO provider, JWT token verification
- **Traffic Center** (ag3.q37fh758g.click): Links to Retention Center in sidebar
- **Creative Center** (ag1.q37fh758g.click): Links to Retention Center in sidebar
- **Keitaro**: Postback webhooks for conversion tracking (subid, status, revenue)
- **Meta CAPI**: Bidirectional — receives leads from Meta, sends conversion events back
- **Zapier**: Facebook Lead Ads → Zapier webhook → lead creation

---

*Snapshot generated: 2026-02-24*
