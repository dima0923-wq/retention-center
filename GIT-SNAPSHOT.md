# Retention Center -- Git History Snapshot

**Generated**: 2026-02-20
**Repository**: `dima0923-wq/retention-center` (GitHub)
**Branch**: `main`
**Total commits**: 6
**Author**: Sky (all commits)
**Total lines added**: 42,175 | **Deleted**: 4,597 | **Net**: 37,578

---

## Repository Info

- **Remote**: `origin` -> `github.com/dima0923-wq/retention-center.git`
- **Branches**: `main` (local) + `remotes/origin/main`
- **Unpushed commits**: 2 (`bc5c5d1`, `8c66b5c`) -- 124 files changed, 11,108 insertions, 463 deletions

---

## Commit Timeline (newest first)

### 1. `8c66b5c` -- Full QA audit fix: 87 issues across schema, APIs, services, UI, config
- **Date**: 2026-02-19 23:28:22 UTC
- **Files changed**: 96
- **Lines**: +5,285 / -634
- **Key changes**:
  - Added `docs/business-analysis.md` (428 lines)
  - Major Prisma schema expansion (+140 lines)
  - New Sequences module: pages (list, detail, edit, new), API routes (CRUD, activate, pause, enroll, enrollments, stats, dashboard-stats)
  - New sequence components: `EnrollmentTable`, `SequenceCard`, `SequenceTimeline`, `StepEditor`
  - New services: `retention-sequence.service.ts` (787 lines), `sequence-processor.service.ts` (159 lines)
  - Enhanced learning page with `ChannelMixChart`, `RecommendedActions`, `SequencePerformance` components
  - New API routes: scheduler/sequences, learning/channel-mix, learning/heatmap, learning/recommendations, learning/sequence-performance
  - Dashboard page rewrite (+208 lines)
  - Sidebar restructured (removed sidebar-store.ts)
  - Expanded validators (+101 lines)
  - Fixes across all webhook routes, channel services, campaign APIs

### 2. `bc5c5d1` -- Add Test Send page, campaign-level VAPI settings, fix Radix Select bugs
- **Date**: 2026-02-19 12:41:59 UTC
- **Files changed**: 25
- **Lines**: +2,060 / -80
- **Key changes**:
  - New Test Send page (552 lines) -- test email/SMS/call from UI
  - New VAPI integration APIs: assistants, phone-numbers, test-call, voices
  - New test-send API routes: call, email, sms
  - `VapiIntegrationCard` component (452 lines)
  - Campaign form expanded with VAPI settings (+220 lines)
  - `CallScriptEditor` expanded (+176 lines)
  - VAPI service enhanced (+67 lines)

### 3. `dfd7d4d` -- Full QA pass: fix all channel services, add self-learning engine, Keitaro postbacks, A/B testing, parallel channel execution, contact scheduling
- **Date**: 2026-02-19 12:05:57 UTC
- **Files changed**: 56
- **Lines**: +4,159 / -145
- **Key changes**:
  - Prisma schema: +53 lines (new models for learning/AB testing)
  - New pages: Conversions (298 lines), Learning (374 lines)
  - New services: `learning.service.ts` (550 lines), `ab-test.service.ts` (200 lines), `scheduler.service.ts` (299 lines), `lead-router.service.ts` (131 lines)
  - New learning components: `ABTestCard`, `ConversionHeatmap`, `InsightCard`, `WordPerformance`
  - New integration: `KeitaroIntegrationCard` (173 lines)
  - Keitaro webhook handler (137 lines)
  - Channel router expanded with parallel execution (+197 lines)
  - Campaign service expanded (+108 lines)
  - New API routes: AB tests, learning insights/funnel/suggestions/words, contact-attempts, conversions, scheduler

### 4. `9176acc` -- Add Instantly.ai email integration, deploy script, and campaign meta field
- **Date**: 2026-02-19 11:50:24 UTC
- **Files changed**: 29
- **Lines**: +2,633 / -192
- **Key changes**:
  - `deploy.sh` created (27 lines)
  - Instantly.ai integration: `InstantlyIntegrationCard` (313 lines), accounts/campaigns/webhook-setup API routes
  - `InstantlyStats` component (156 lines)
  - `EmailAnalytics` component (285 lines)
  - Email service rewritten with Instantly.ai support (+372 lines)
  - `EmailTemplateEditor` expanded (+222 lines)
  - Dashboard page expanded (+161 lines)
  - Instantly webhook handler (85 lines)
  - Report service expanded (+161 lines)
  - Lead service expanded (+86 lines)
  - Campaign service expanded (+97 lines)

### 5. `e931da1` -- Add retention center app: campaigns, leads, scripts, reports, integrations
- **Date**: 2026-02-19 11:37:56 UTC
- **Files changed**: 115
- **Lines**: +21,163 / -3,546
- **Key changes**:
  - Full application scaffold from Next.js starter
  - Prisma setup: schema (107 lines), migration, seed (201 lines), config
  - Dashboard pages: campaigns (list/detail/edit/new), leads (list/detail), scripts (list/detail/new), reports, integrations
  - Dashboard layout with sidebar + header
  - All UI components (shadcn/ui): avatar, badge, button, calendar, card, command, dialog, dropdown-menu, form, input, label, popover, select, separator, sheet, sonner, table, tabs, textarea
  - Campaign components: Card, Form, LeadTable, StatusBadge, ChannelSelector
  - Lead components: AddDialog, DetailCard, Filters, StatusBadge, Table, Timeline, SendSmsDialog
  - Script components: CallScriptEditor, EmailTemplateEditor, ScriptList, ScriptPreview, SmsTemplateEditor, TemplateVariableInserter
  - Report components: CampaignComparisonTable, ChannelPerformanceChart, ConversionFunnel, DateRangePicker, ExportButton, StatsCard, TimelineChart
  - Integration components: ConnectionStatus, IntegrationCard, SmsIntegrationCard, TestConnectionButton, WebhookUrlDisplay
  - All API routes: campaigns CRUD, leads CRUD, scripts CRUD, reports, integrations, webhooks (email/meta/sms/vapi)
  - Services: campaign, lead, script, report, channel-router, email, sms, vapi
  - Type definitions, validators, utilities

### 6. `01eb60d` -- Initial commit from Create Next App
- **Date**: 2026-02-18 18:07:29 UTC
- **Files changed**: 17
- **Lines**: +6,875 / -0
- **Key changes**:
  - Next.js boilerplate: package.json, tsconfig, eslint, postcss, globals.css
  - Default page, layout, favicon
  - Public assets (SVGs)

---

## Top 20 Most Changed Files (by total lines touched)

| Lines | File |
|------:|------|
| 925 | `src/services/learning.service.ts` |
| 787 | `src/services/retention-sequence.service.ts` |
| 726 | `src/components/campaigns/CampaignForm.tsx` |
| 626 | `src/app/(dashboard)/page.tsx` |
| 624 | `src/components/integrations/VapiIntegrationCard.tsx` |
| 601 | `src/app/(dashboard)/test-send/page.tsx` |
| 533 | `src/services/report.service.ts` |
| 530 | `src/services/channel/email.service.ts` |
| 524 | `src/app/(dashboard)/learning/page.tsx` |
| 491 | `src/app/(dashboard)/campaigns/[id]/page.tsx` |
| 455 | `src/services/campaign.service.ts` |
| 433 | `src/services/channel/sms.service.ts` |
| 428 | `docs/business-analysis.md` |
| 385 | `src/components/integrations/InstantlyIntegrationCard.tsx` |
| 366 | `src/components/scripts/CallScriptEditor.tsx` |
| 351 | `src/services/channel/channel-router.service.ts` |
| 349 | `src/services/scheduler.service.ts` |
| 329 | `src/app/(dashboard)/sequences/new/page.tsx` |
| 320 | `src/app/(dashboard)/sequences/[id]/page.tsx` |
| 318 | `src/components/integrations/SmsIntegrationCard.tsx` |

---

## Feature Evolution Summary

| Feature | Introduced | Enhanced |
|---------|-----------|----------|
| Campaigns CRUD | `e931da1` | `9176acc`, `dfd7d4d`, `bc5c5d1`, `8c66b5c` |
| Leads management | `e931da1` | `9176acc`, `dfd7d4d`, `8c66b5c` |
| Scripts (SMS/email/call) | `e931da1` | `9176acc`, `bc5c5d1`, `8c66b5c` |
| Reports & analytics | `e931da1` | `9176acc`, `dfd7d4d`, `8c66b5c` |
| SMS channel | `e931da1` | `dfd7d4d`, `8c66b5c` |
| Email channel (Instantly.ai) | `9176acc` | `dfd7d4d`, `8c66b5c` |
| VAPI voice calls | `e931da1` | `bc5c5d1`, `8c66b5c` |
| Integrations page | `e931da1` | `9176acc`, `dfd7d4d`, `bc5c5d1`, `8c66b5c` |
| Keitaro postbacks | `dfd7d4d` | `8c66b5c` |
| Self-learning engine | `dfd7d4d` | `8c66b5c` |
| A/B testing | `dfd7d4d` | `8c66b5c` |
| Test Send page | `bc5c5d1` | `8c66b5c` |
| Sequences (multi-step) | `8c66b5c` | -- |
| Scheduler service | `dfd7d4d` | `8c66b5c` |
| Deploy script | `9176acc` | -- |

---

## Tech Stack (from codebase)

- **Framework**: Next.js 16 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **ORM**: Prisma 7 + SQLite
- **Language**: TypeScript
- **Integrations**: Instantly.ai (email), VAPI (voice), Keitaro (conversions), Meta (webhooks)
- **Architecture**: API routes + service layer pattern
