# Retention Center — Project Snapshot (2026-02-21)

## Overview

SMS, email, and call conversion center for automated lead retention campaigns. Part of the Fully Automated Media Buying Platform (Project 3 of 3).

- **Domain**: https://ag2.q37fh758g.click
- **Server**: 38.180.64.126 (Ubuntu, 99GB disk, 8% used)
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
| Email | Instantly.ai API V2 |
| Node.js | v20.20.0 (server) |

---

## Git Status

- **Latest commit**: `7e79c6a` — "Fix: API routes return 401 JSON instead of 307 redirect for unauthenticated requests"
- **Total commits**: 11 on main
- **Local = GitHub = Server**: All in sync as of 2026-02-21
- **Last server deploy**: 2026-02-20 20:40 UTC

### Commit History (all)

```
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
        integrations/     # Integration config pages
        leads/            # Lead management pages
        learning/         # Self-learning engine pages
        page.tsx          # Dashboard home (stats + charts)
        reports/          # Reporting pages
        scripts/          # Script management pages
        sequences/        # Retention sequence pages
        test-send/        # Test send page
      api/                # API routes
        campaigns/        # Campaign CRUD API
        contact-attempts/ # Contact attempt API
        conversions/      # Conversion + stats API
        instantly/        # Instantly.ai proxy API
        integrations/     # Integration config API
        leads/            # Lead CRUD API
        learning/         # Self-learning engine API
        reports/          # Report generation API
        scheduler/        # Scheduler API
        scripts/          # Script CRUD API
        sequences/        # Retention sequence API
        test-send/        # Test send API
        webhooks/         # Keitaro postback webhooks (public)
      auth/               # Auth routes
        callback/         # Auth Center callback page
        logout/           # Server-side logout route
        token/            # Token exchange route
    components/           # UI components
      campaigns/
      integrations/
      layout/             # Sidebar + Header
      leads/
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
      validators.ts       # Zod validators
    services/             # Business logic services
      channel/            # Channel-specific services
        channel-router.service.ts  (293 lines)
        email.service.ts           (406 lines)
        sms.service.ts             (443 lines)
        vapi.service.ts            (262 lines)
      ab-test.service.ts           (198 lines)
      campaign.service.ts          (425 lines)
      lead-router.service.ts       (141 lines)
      lead.service.ts              (268 lines)
      learning.service.ts          (859 lines)
      report.service.ts            (463 lines)
      retention-sequence.service.ts (787 lines)
      scheduler.service.ts          (291 lines)
      script.service.ts             (145 lines)
      sequence-processor.service.ts (159 lines)
    types/                # TypeScript type definitions
```

---

## Database Schema (Prisma/SQLite)

### Models (12 total)

| Model | Purpose |
|-------|---------|
| **Lead** | Contact records (name, phone, email, source, status) |
| **Campaign** | Marketing campaigns (name, channels, dates, status) |
| **CampaignLead** | Many-to-many campaign-lead assignment |
| **Script** | Channel scripts (EMAIL/SMS/CALL) with VAPI config |
| **ContactAttempt** | Individual contact attempt records (channel, status, cost, result) |
| **IntegrationConfig** | Provider configs (Instantly, VAPI, etc.) |
| **Conversion** | Conversion tracking (revenue, source, Keitaro subId/clickId) |
| **ConversionRule** | Self-learning conversion rules (channel, metric, confidence) |
| **ABTest** | A/B testing framework (variants, stats, winner) |
| **RetentionSequence** | Multi-step retention workflows (trigger, channels) |
| **SequenceStep** | Individual steps in a sequence (channel, delay, conditions) |
| **SequenceEnrollment** | Lead enrollment in sequences (status, progress) |
| **SequenceStepExecution** | Step execution tracking (scheduled, executed, result) |

### Key Relationships

- Lead -> CampaignLead -> Campaign (many-to-many)
- Lead -> ContactAttempt -> Script
- Lead -> SequenceEnrollment -> RetentionSequence -> SequenceStep
- Campaign -> ABTest
- ContactAttempt -> Conversion
- SequenceStepExecution -> SequenceEnrollment + SequenceStep + ContactAttempt

### Database File

- **Server**: `/opt/retention-center/prod.db` (260KB, SQLite)
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

### Auth Files

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Route protection, JWT format check, Auth Center redirect |
| `src/lib/auth.ts` | Client-side: getCookie, getAuthToken, getAuthHeaders, redirectToLogin |
| `src/lib/api-auth.ts` | Server-side: verifyApiAuth (calls Auth Center /api/auth/verify), token cache (5min), AuthError class |
| `src/lib/user-context.tsx` | React UserProvider: JWT decode, expiration check, cross-tab logout, bfcache protection |

### Auth Configuration (Server .env)

```
AUTH_CENTER_URL=https://ag4.q37fh758g.click
NEXT_PUBLIC_AUTH_CENTER_URL=https://ag4.q37fh758g.click
PROJECT_ID=retention_center
```

### Public Paths (no auth required)

- `/auth/*` — Auth routes
- `/_next/*` — Next.js assets
- `/api/webhooks/*` — Keitaro postback webhooks
- `/favicon.ico`
- `/api/auth/*` — Auth API routes

---

## Features

### 1. Dashboard (Home Page)
- Overview stats: total leads, active campaigns, conversion rate, contact attempts
- Retention sequence stats: active sequences, enrolled leads, conversion rate, completed
- Email campaign stats (Instantly.ai): total sent, open rate, reply rate, bounce rate
- Conversion stats: total conversions, revenue, conversion rate
- 7-day trend charts: leads + contact activity (Recharts LineChart)
- Upcoming sequence steps + recent sequence activity tables

### 2. Lead Management
- CRUD operations for contacts
- Fields: name, phone, email, source, status, notes
- Indexed by email, phone, status

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

### 7. Integrations
- **Instantly.ai**: Email sending via API V2 (analytics, campaigns)
- **VAPI**: Voice AI for automated calls
- **SMS**: SMS service integration
- Provider config stored in IntegrationConfig model

### 8. Conversions & Keitaro Postbacks
- Conversion tracking with revenue
- Keitaro postback webhooks (subid, status, revenue, clickId)
- Source tracking (keitaro default)

### 9. A/B Testing
- Campaign-level A/B tests
- Variant comparison with stats
- Winner selection

### 10. Self-Learning Engine
- Conversion rule analysis (channel, metric, confidence)
- Sample size tracking
- Automatic optimization rules

### 11. Reports
- Overview reports with date filtering
- Timeline reports (daily aggregation)
- Channel performance analysis

### 12. Test Send
- Test page for sending individual emails/SMS/calls
- Useful for debugging channel integrations

### 13. Scheduler
- Contact scheduling API
- Automated sequence step execution

---

## Server Configuration

### Systemd Service

- **Service**: `retention-center.service`
- **Status**: Active (running since 2026-02-20 20:40 UTC)
- **Port**: 3001 (Next.js)

### Nginx

- **Config**: `/etc/nginx/sites-enabled/retention-center`
- **SSL**: Let's Encrypt (certbot auto-managed)
- **Proxy**: localhost:3001 with WebSocket upgrade support
- **HTTP->HTTPS**: Auto redirect

### Server Environment (.env)

```
DATABASE_URL="file:./prod.db"
INSTANTLY_API_KEY=placeholder
NEXT_PUBLIC_APP_URL=https://ag2.q37fh758g.click
AUTH_CENTER_URL=https://ag4.q37fh758g.click
PROJECT_ID=retention_center
NEXT_PUBLIC_AUTH_CENTER_URL=https://ag4.q37fh758g.click
```

### Disk Usage

- Total: 99GB, Used: 7.2GB (8%), Available: 87GB

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

## Services Architecture (5,140 lines total)

| Service | Lines | Purpose |
|---------|-------|---------|
| learning.service.ts | 859 | Self-learning engine, conversion rule analysis |
| retention-sequence.service.ts | 787 | Sequence management, enrollment, step execution |
| report.service.ts | 463 | Report generation, overview/timeline aggregation |
| sms.service.ts | 443 | SMS channel integration |
| campaign.service.ts | 425 | Campaign CRUD, lead assignment |
| email.service.ts | 406 | Instantly.ai email integration |
| channel-router.service.ts | 293 | Route contacts to correct channel service |
| scheduler.service.ts | 291 | Scheduling logic for automated contacts |
| lead.service.ts | 268 | Lead CRUD operations |
| vapi.service.ts | 262 | VAPI voice AI integration |
| ab-test.service.ts | 198 | A/B testing framework |
| sequence-processor.service.ts | 159 | Process sequence step executions |
| script.service.ts | 145 | Script template CRUD |
| lead-router.service.ts | 141 | Lead routing/assignment logic |

---

## API Routes (15 route groups)

| Route | Purpose |
|-------|---------|
| /api/campaigns | Campaign CRUD |
| /api/contact-attempts | Contact attempt tracking |
| /api/conversions | Conversion CRUD + stats |
| /api/instantly | Instantly.ai proxy (analytics) |
| /api/integrations | Integration config CRUD |
| /api/leads | Lead CRUD |
| /api/learning | Self-learning engine API |
| /api/reports | Overview + timeline reports |
| /api/scheduler | Scheduling API |
| /api/scripts | Script CRUD |
| /api/sequences | Retention sequence CRUD + dashboard stats |
| /api/test-send | Test send endpoint |
| /api/webhooks | Keitaro postback webhooks (public, no auth) |
| /api/auth | Auth-related API routes |
| /auth/* | Auth pages (callback, token, logout) |

---

## UI Components

### Layout
- **Sidebar**: Fixed left sidebar (240px / pl-60) with navigation links
- **Header**: Top header bar with user context

### Dashboard Sections (10 pages)
1. Dashboard (home)
2. Campaigns
3. Leads
4. Scripts
5. Sequences
6. Integrations
7. Learning
8. Reports
9. Conversions
10. Test Send

### UI Library
- shadcn/ui components in `src/components/ui/`
- Radix UI primitives
- Lucide React icons
- Sonner toast notifications (top-right)

---

## Known Issues / Notes

- `INSTANTLY_API_KEY` is set to `placeholder` on server (not configured for production)
- Database is small (260KB) suggesting minimal production data
- No VAPI production keys configured
- SMS service exists but no production provider configured
- All API routes (except webhooks) require auth via middleware or return 401

---

## Cross-Project Integration

- **Auth Center** (ag4.q37fh758g.click): SSO provider, JWT token verification
- **Traffic Center** (ag3.q37fh758g.click): Links to Retention Center in sidebar
- **Creative Center** (ag1.q37fh758g.click): Links to Retention Center in sidebar
- **Keitaro**: Postback webhooks for conversion tracking (subid, status, revenue)

---

*Snapshot generated: 2026-02-21*
