# Retention Center - Project Folder Structure Snapshot

**Generated**: 2026-02-20
**Stack**: Next.js 16.1.6 + Tailwind CSS 4 + shadcn/ui + Prisma 7.4 + SQLite (libsql adapter)
**Node**: React 19.2.3, TypeScript 5, Zod 4, Zustand 5, Recharts 3
**Email Provider**: Instantly.ai API V2
**Voice Provider**: VAPI
**Output**: Standalone (`next.config.ts` -> `output: "standalone"`)
**Database**: SQLite via `@prisma/adapter-libsql`, file at `./dev.db` (local) or `DATABASE_URL` env
**Git commits**: 6 total on main branch

---

## Top-Level Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies & scripts (`dev`, `build`, `start`, `lint`, `postinstall: prisma generate`) |
| `next.config.ts` | Next.js config — standalone output mode |
| `prisma.config.ts` | Prisma 7 config — schema path, migrations dir, seed command |
| `components.json` | shadcn/ui component registry config |
| `deploy.sh` | Deployment script — rsync to 38.180.64.126, npm install, prisma generate/push, build, restart service |
| `eslint.config.mjs` | ESLint configuration |
| `postcss.config.mjs` | PostCSS config (Tailwind) |
| `tsconfig.json` | TypeScript configuration |
| `.env` | Environment variables (DATABASE_URL) |
| `.env.example` | Template: DATABASE_URL, INSTANTLY_API_KEY, NEXT_PUBLIC_APP_URL, META_WEBHOOK_VERIFY_TOKEN |
| `.gitignore` | Ignores: node_modules, .next, .env*, *.db, src/generated/prisma, *.tsbuildinfo |
| `dev.db` | Local SQLite database file |

---

## Directory Tree

```
retention-center/
├── docs/
│   └── business-analysis.md          # Full business flow documentation (Meta lead lifecycle)
├── prisma/
│   ├── schema.prisma                  # Database schema (13 models)
│   ├── seed.ts                        # Database seed script
│   └── migrations/
│       └── 20260218183952_init/       # Initial migration
├── public/                            # Static assets (SVG icons)
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout (Inter font, Toaster)
│   │   ├── globals.css                # Global styles
│   │   ├── (dashboard)/               # Dashboard route group
│   │   │   ├── layout.tsx             # Sidebar + Header layout wrapper
│   │   │   ├── page.tsx               # Main dashboard (stats, charts, activity)
│   │   │   ├── campaigns/             # Campaign management pages
│   │   │   ├── conversions/           # Conversion tracking page
│   │   │   ├── integrations/          # Integration settings page
│   │   │   ├── leads/                 # Lead management pages
│   │   │   ├── learning/              # Self-learning engine page
│   │   │   ├── reports/               # Reporting & analytics page
│   │   │   ├── scripts/               # Script/template management pages
│   │   │   ├── sequences/             # Retention sequence pages
│   │   │   └── test-send/             # Test send page (email/SMS/call)
│   │   └── api/                       # API routes (Next.js Route Handlers)
│   │       ├── campaigns/             # Campaign CRUD + actions
│   │       ├── contact-attempts/      # Contact attempt listing
│   │       ├── conversions/           # Conversion CRUD + stats
│   │       ├── instantly/             # Instantly.ai analytics proxy
│   │       ├── integrations/          # Integration config + provider-specific
│   │       ├── leads/                 # Lead CRUD + bulk + stats
│   │       ├── learning/              # ML/learning engine endpoints
│   │       ├── reports/               # Report data endpoints
│   │       ├── scheduler/             # Sequence scheduler + processor
│   │       ├── scripts/               # Script CRUD + duplicate
│   │       ├── sequences/             # Sequence CRUD + actions
│   │       ├── test-send/             # Test send endpoints (email/SMS/call)
│   │       └── webhooks/              # Inbound webhooks (email, instantly, keitaro, meta, sms, vapi)
│   ├── components/
│   │   ├── campaigns/                 # Campaign UI components
│   │   ├── integrations/              # Integration UI components
│   │   ├── layout/                    # Sidebar + Header
│   │   ├── leads/                     # Lead UI components
│   │   ├── learning/                  # Learning engine UI components
│   │   ├── reports/                   # Report UI components
│   │   ├── scripts/                   # Script editor UI components
│   │   ├── sequences/                 # Sequence UI components
│   │   └── ui/                        # shadcn/ui primitives (20 components)
│   ├── generated/
│   │   └── prisma/                    # Auto-generated Prisma client (gitignored)
│   ├── lib/
│   │   ├── db.ts                      # Prisma client singleton (libsql adapter)
│   │   ├── utils.ts                   # Utility functions (cn, etc.)
│   │   └── validators.ts             # Zod validation schemas (leads, campaigns, scripts, sequences, conversions, A/B tests)
│   ├── services/                      # Business logic layer
│   │   ├── ab-test.service.ts         # A/B testing service (198 lines)
│   │   ├── campaign.service.ts        # Campaign CRUD + lead management (425 lines)
│   │   ├── lead.service.ts            # Lead CRUD + filtering + stats (268 lines)
│   │   ├── lead-router.service.ts     # Auto-routing new leads to campaigns (141 lines)
│   │   ├── learning.service.ts        # Self-learning engine — insights, recommendations, heatmaps (859 lines)
│   │   ├── report.service.ts          # Report generation — overview, timeline, channels (463 lines)
│   │   ├── retention-sequence.service.ts  # Sequence CRUD + enrollment + step management (787 lines)
│   │   ├── scheduler.service.ts       # Sequence step scheduling & processing (291 lines)
│   │   ├── script.service.ts          # Script CRUD (145 lines)
│   │   ├── sequence-processor.service.ts  # Step execution logic (159 lines)
│   │   └── channel/                   # Channel-specific services
│   │       ├── channel-router.service.ts  # Multi-channel router — parallel execution (293 lines)
│   │       ├── email.service.ts       # Instantly.ai email sending (406 lines)
│   │       ├── sms.service.ts         # SMS sending service (443 lines)
│   │       └── vapi.service.ts        # VAPI voice call service (262 lines)
│   └── types/
│       └── index.ts                   # TypeScript type definitions & Prisma re-exports
└── node_modules/                      # Dependencies
```

---

## Prisma Schema (13 Models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Lead` | Contact records | firstName, lastName, phone, email, source, status, meta |
| `Campaign` | Outreach campaigns | name, status, channels (JSON), meta, startDate/endDate |
| `CampaignLead` | Many-to-many join | campaignId, leadId, status |
| `Script` | Message templates | name, type (CALL/SMS/EMAIL), content, vapiConfig |
| `ContactAttempt` | Outreach attempts | leadId, channel, status, provider, providerRef, cost, duration |
| `IntegrationConfig` | Provider settings | provider (unique), type, config (JSON), isActive |
| `Conversion` | Conversion tracking | leadId, campaignId, revenue, status, subId, clickId, source |
| `ConversionRule` | Conversion rules | channel, metric, value, conversionRate, sampleSize |
| `ABTest` | A/B test tracking | campaignId, channel, variantA/B, status, statsA/B |
| `RetentionSequence` | Multi-step sequences | name, status, channels, triggerType, triggerConfig |
| `SequenceStep` | Sequence steps | sequenceId, stepOrder, channel, scriptId, delayValue/Unit |
| `SequenceEnrollment` | Lead-in-sequence tracking | sequenceId, leadId, status, currentStep |
| `SequenceStepExecution` | Step execution log | enrollmentId, stepId, status, scheduledAt, executedAt |

### Lead Statuses
`NEW` | `CONTACTED` | `IN_PROGRESS` | `CONVERTED` | `LOST` | `DO_NOT_CONTACT`

### Campaign Statuses
`DRAFT` | `ACTIVE` | `PAUSED` | `COMPLETED`

### Sequence Statuses
`DRAFT` | `ACTIVE` | `PAUSED` | `ARCHIVED`

### Enrollment Statuses
`ACTIVE` | `PAUSED` | `COMPLETED` | `CANCELLED` | `CONVERTED`

### Channels
`EMAIL` | `SMS` | `CALL`

---

## Dashboard Pages (10 pages)

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Overview stats, sequence stats, email stats, conversion stats, 7-day charts, recent activity |
| `/leads` | Lead List | Filterable/searchable lead table with status badges |
| `/leads/[id]` | Lead Detail | Lead info, contact history timeline |
| `/campaigns` | Campaign List | Campaign cards with lead counts |
| `/campaigns/new` | New Campaign | Campaign creation form (channels, schedule, auto-assign, VAPI config) |
| `/campaigns/[id]` | Campaign Detail | Campaign info, lead table, stats, Instantly sync |
| `/campaigns/[id]/edit` | Edit Campaign | Campaign edit form |
| `/conversions` | Conversions | Conversion tracking and listing |
| `/integrations` | Integrations | Provider connection management (Instantly, VAPI, Keitaro, SMS) |
| `/learning` | Learning | Self-learning engine: insights, A/B tests, heatmaps, recommendations, word performance |
| `/reports` | Reports | Campaign comparison, channel performance, conversion funnel, timeline charts, export |
| `/scripts` | Scripts | Script/template list (email, SMS, call) |
| `/scripts/new` | New Script | Script creation with template variable inserter |
| `/scripts/[id]` | Script Detail | Script preview and editing |
| `/sequences` | Sequences | Retention sequence list with status badges |
| `/sequences/new` | New Sequence | Sequence builder with step editor |
| `/sequences/[id]` | Sequence Detail | Sequence info, enrollment table, stats |
| `/sequences/[id]/edit` | Edit Sequence | Sequence step editor |
| `/test-send` | Test Send | Test email/SMS/call sending interface |

---

## API Routes (74 route files)

### Campaigns (`/api/campaigns/`)
- `GET/POST` `/api/campaigns` — List & create campaigns
- `GET/PUT/DELETE` `/api/campaigns/[id]` — Campaign CRUD
- `POST` `/api/campaigns/[id]/instantly` — Sync campaign with Instantly.ai
- `GET/POST` `/api/campaigns/[id]/leads` — Campaign lead management
- `POST` `/api/campaigns/[id]/pause` — Pause campaign
- `POST` `/api/campaigns/[id]/start` — Start campaign
- `GET` `/api/campaigns/[id]/stats` — Campaign statistics

### Leads (`/api/leads/`)
- `GET/POST` `/api/leads` — List & create leads
- `GET/PUT/DELETE` `/api/leads/[id]` — Lead CRUD
- `POST` `/api/leads/[id]/sms` — Send SMS to lead
- `POST` `/api/leads/bulk` — Bulk lead import
- `GET` `/api/leads/stats` — Lead statistics

### Scripts (`/api/scripts/`)
- `GET/POST` `/api/scripts` — List & create scripts
- `GET/PUT/DELETE` `/api/scripts/[id]` — Script CRUD
- `POST` `/api/scripts/[id]/duplicate` — Duplicate script

### Sequences (`/api/sequences/`)
- `GET/POST` `/api/sequences` — List & create sequences
- `GET/PUT/DELETE` `/api/sequences/[id]` — Sequence CRUD
- `POST` `/api/sequences/[id]/activate` — Activate sequence
- `POST` `/api/sequences/[id]/enroll` — Enroll leads
- `GET` `/api/sequences/[id]/enrollments` — List enrollments
- `POST` `/api/sequences/[id]/pause` — Pause sequence
- `GET` `/api/sequences/[id]/stats` — Sequence stats
- `GET` `/api/sequences/dashboard-stats` — Dashboard overview stats

### Integrations (`/api/integrations/`)
- `GET/POST` `/api/integrations` — List & create integration configs
- `GET/PUT/DELETE` `/api/integrations/[provider]` — Provider config CRUD
- `POST` `/api/integrations/[provider]/test` — Test connection
- `GET` `/api/integrations/instantly/accounts` — List Instantly accounts
- `GET` `/api/integrations/instantly/campaigns` — List Instantly campaigns
- `POST` `/api/integrations/instantly/webhook-setup` — Setup Instantly webhooks
- `GET` `/api/integrations/vapi/assistants` — List VAPI assistants
- `GET` `/api/integrations/vapi/phone-numbers` — List VAPI phone numbers
- `POST` `/api/integrations/vapi/test-call` — Make test VAPI call
- `GET` `/api/integrations/vapi/voices` — List VAPI voices

### Conversions (`/api/conversions/`)
- `GET/POST` `/api/conversions` — List & create conversions
- `GET` `/api/conversions/stats` — Conversion statistics

### Learning Engine (`/api/learning/`)
- `GET/POST` `/api/learning/ab-tests` — A/B test management
- `GET/PUT` `/api/learning/ab-tests/[id]` — A/B test detail
- `GET` `/api/learning/channel-mix` — Channel mix analysis
- `GET` `/api/learning/funnel` — Conversion funnel data
- `GET` `/api/learning/heatmap` — Conversion heatmap
- `GET` `/api/learning/insights` — Generated insights
- `GET` `/api/learning/recommendations` — Action recommendations
- `GET` `/api/learning/sequence-performance` — Sequence performance data
- `GET` `/api/learning/suggestions` — Smart suggestions
- `GET` `/api/learning/words` — Word/phrase performance analysis

### Reports (`/api/reports/`)
- `GET` `/api/reports/campaigns` — Campaign comparison data
- `GET` `/api/reports/channels` — Channel performance data
- `GET` `/api/reports/leads` — Lead report data
- `GET` `/api/reports/overview` — Overview statistics
- `GET` `/api/reports/timeline` — Timeline chart data

### Webhooks (`/api/webhooks/`)
- `POST` `/api/webhooks/email` — Inbound email webhook
- `POST` `/api/webhooks/instantly` — Instantly.ai event webhook
- `POST` `/api/webhooks/keitaro` — Keitaro conversion postback
- `GET/POST` `/api/webhooks/meta` — Meta lead webhook (GET for verify, POST for events)
- `POST` `/api/webhooks/sms` — Inbound SMS webhook
- `POST` `/api/webhooks/vapi` — VAPI call event webhook

### Other
- `GET` `/api/contact-attempts` — List contact attempts
- `GET` `/api/instantly/analytics` — Instantly analytics proxy
- `POST` `/api/scheduler/process` — Process scheduled sequence steps
- `GET` `/api/scheduler/sequences` — List scheduled sequences
- `POST` `/api/test-send/call` — Test call
- `POST` `/api/test-send/email` — Test email
- `POST` `/api/test-send/sms` — Test SMS

---

## Components (58 custom components + 20 UI primitives)

### Layout (2)
- `header.tsx` — Page header
- `sidebar.tsx` — Fixed sidebar with nav links + external links (Creative Center, Traffic Center)

### Campaigns (6)
- `CampaignCard.tsx` — Campaign list card
- `CampaignForm.tsx` — Campaign create/edit form
- `CampaignLeadTable.tsx` — Leads assigned to campaign
- `CampaignStatusBadge.tsx` — Status badge component
- `ChannelSelector.tsx` — Multi-channel selection
- `InstantlyStats.tsx` — Instantly email stats display

### Integrations (7)
- `ConnectionStatus.tsx` — Connection status indicator
- `InstantlyIntegrationCard.tsx` — Instantly.ai settings card
- `IntegrationCard.tsx` — Generic integration card
- `KeitaroIntegrationCard.tsx` — Keitaro tracker settings
- `SmsIntegrationCard.tsx` — SMS provider settings
- `TestConnectionButton.tsx` — Test connection button
- `VapiIntegrationCard.tsx` — VAPI voice settings
- `WebhookUrlDisplay.tsx` — Webhook URL display/copy

### Leads (7)
- `AddLeadDialog.tsx` — Add new lead dialog
- `LeadDetailCard.tsx` — Lead detail display
- `LeadFilters.tsx` — Lead filtering controls
- `LeadStatusBadge.tsx` — Status badge
- `LeadTable.tsx` — Lead data table
- `LeadTimeline.tsx` — Contact attempt timeline
- `SendSmsDialog.tsx` — Send SMS dialog

### Learning (7)
- `ABTestCard.tsx` — A/B test display
- `ChannelMixChart.tsx` — Channel distribution chart
- `ConversionHeatmap.tsx` — Conversion heatmap visualization
- `InsightCard.tsx` — Learning insight card
- `RecommendedActions.tsx` — Action recommendations
- `SequencePerformance.tsx` — Sequence performance chart
- `WordPerformance.tsx` — Word/phrase effectiveness

### Reports (8)
- `CampaignComparisonTable.tsx` — Campaign comparison
- `ChannelPerformanceChart.tsx` — Channel performance chart
- `ConversionFunnel.tsx` — Funnel visualization
- `DateRangePicker.tsx` — Date range selector
- `EmailAnalytics.tsx` — Email analytics display
- `ExportButton.tsx` — Data export button
- `StatsCard.tsx` — Stats card component
- `TimelineChart.tsx` — Timeline chart

### Scripts (6)
- `CallScriptEditor.tsx` — Call script editor
- `EmailTemplateEditor.tsx` — Email template editor
- `ScriptList.tsx` — Script listing
- `ScriptPreview.tsx` — Script preview
- `SmsTemplateEditor.tsx` — SMS template editor
- `TemplateVariableInserter.tsx` — Variable insertion tool

### Sequences (4)
- `EnrollmentTable.tsx` — Enrollment listing table
- `SequenceCard.tsx` — Sequence list card
- `SequenceTimeline.tsx` — Visual sequence step timeline
- `StepEditor.tsx` — Sequence step editor

### UI Primitives (20 shadcn/ui components)
avatar, badge, button, calendar, card, command, dialog, dropdown-menu, form, input, label, popover, select, separator, sheet, sonner, table, tabs, textarea

---

## Services Layer (14 services, ~5,140 lines total)

| Service | Lines | Purpose |
|---------|-------|---------|
| `learning.service.ts` | 859 | Self-learning engine: insights, recommendations, heatmaps, word analysis, channel mix |
| `retention-sequence.service.ts` | 787 | Sequence CRUD, enrollment, step management, stats |
| `report.service.ts` | 463 | Report generation: overview, timeline, campaigns, channels, leads |
| `channel/sms.service.ts` | 443 | SMS sending via provider API |
| `campaign.service.ts` | 425 | Campaign CRUD, lead assignment, Instantly sync |
| `channel/email.service.ts` | 406 | Email sending via Instantly.ai API V2 |
| `channel/channel-router.service.ts` | 293 | Multi-channel router, parallel execution, priority sorting |
| `scheduler.service.ts` | 291 | Sequence step scheduling and processing |
| `lead.service.ts` | 268 | Lead CRUD, filtering, pagination, stats |
| `channel/vapi.service.ts` | 262 | VAPI voice call integration |
| `ab-test.service.ts` | 198 | A/B test creation, stat tracking, winner selection |
| `sequence-processor.service.ts` | 159 | Step execution logic |
| `script.service.ts` | 145 | Script CRUD operations |
| `lead-router.service.ts` | 141 | Auto-routing new leads to campaigns based on rules |

---

## Key Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite connection string (`file:./dev.db`) |
| `INSTANTLY_API_KEY` | Instantly.ai API key for email campaigns |
| `NEXT_PUBLIC_APP_URL` | Public app URL for webhook URLs |
| `META_WEBHOOK_VERIFY_TOKEN` | Meta webhook verification token |

---

## Deployment

- **Server**: 38.180.64.126 (root / LhH5rfrngQ)
- **Server path**: `/opt/retention-center/`
- **Service**: `retention-center` (systemd)
- **Domain**: `http://ag2.q37fh758g.click`
- **Deploy script**: `deploy.sh` — rsync (excludes node_modules, .next, .git, .env, *.db, .DS_Store, tsconfig.tsbuildinfo) then SSH to run npm install, prisma generate, prisma db push, npm run build, systemctl restart

---

## Sidebar Navigation

1. Dashboard (`/`)
2. Leads (`/leads`)
3. Campaigns (`/campaigns`)
4. Sequences (`/sequences`)
5. Scripts (`/scripts`)
6. Integrations (`/integrations`)
7. Send a test (`/test-send`)
8. Conversions (`/conversions`)
9. Learning (`/learning`)
10. Reports (`/reports`)

**External links**: Creative Center (ag1) | Traffic Center (ag3)

---

## Dependencies Summary

### Runtime
- `next` 16.1.6, `react` 19.2.3
- `prisma` 7.4 + `@prisma/adapter-libsql` + `@libsql/client`
- `zod` 4.3, `react-hook-form` 7.71, `@hookform/resolvers` 5.2
- `recharts` 3.7 (charts)
- `date-fns` 4.1 (date utilities)
- `lucide-react` 0.574 (icons)
- `radix-ui` 1.4 (UI primitives)
- `zustand` 5.0 (state management)
- `sonner` 2.0 (toast notifications)
- `cmdk` 1.1 (command palette)
- `next-themes` 0.4 (theme switching)
- `pg` 8.18 (PostgreSQL client — may be unused/future)

### Dev
- `tailwindcss` 4, `@tailwindcss/postcss`
- `shadcn` 3.8 (component CLI)
- `tsx` 4.21 (TypeScript execution for seeds)
- `tw-animate-css` 1.4 (animations)
- `typescript` 5, `eslint` 9
