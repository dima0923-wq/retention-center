# Retention Center Database Schema

Complete documentation of the Retention Center SQLite database schema, generated from Prisma schema.

**Database Type**: SQLite (file: `./dev.db`)
**ORM**: Prisma v7
**Provider**: libsql
**Generated Client Output**: `src/generated/prisma/client`

---

## Table of Contents
1. [Core Models](#core-models)
2. [Campaign Management](#campaign-management)
3. [Contact & Communication](#contact--communication)
4. [Retention Sequences](#retention-sequences)
5. [Conversions & Analytics](#conversions--analytics)
6. [Integration Config](#integration-config)
7. [Relationships](#relationships)
8. [Indexes](#indexes)

---

## Core Models

### Lead
Core table for tracking individual leads/contacts.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| **id** | String | PK, default: `cuid()` | Unique identifier |
| **externalId** | String? | Optional | External system ID (CRM, etc.) |
| **firstName** | String | Required | Lead first name |
| **lastName** | String | Required | Lead last name |
| **phone** | String? | Optional, Indexed | Phone number (various formats) |
| **email** | String? | Optional, Indexed | Email address |
| **source** | String | Default: `"MANUAL"` | Lead origin (MANUAL, META, API) |
| **status** | String | Default: `"NEW"`, Indexed | NEW, CONTACTED, IN_PROGRESS, CONVERTED, LOST |
| **meta** | String? | Optional | JSON metadata (flexible storage) |
| **notes** | String? | Optional | Free-form notes |
| **createdAt** | DateTime | Default: `now()` | Record creation timestamp |
| **updatedAt** | DateTime | Auto-updated | Last modification timestamp |

**Relations**:
- `campaignLeads[]` → CampaignLead (1-to-many)
- `contactAttempts[]` → ContactAttempt (1-to-many)
- `sequenceEnrollments[]` → SequenceEnrollment (1-to-many)
- `conversions[]` → Conversion (1-to-many)

**Indexes**:
- `email_idx` (email)
- `phone_idx` (phone)
- `status_idx` (status)

---

## Campaign Management

### Campaign
Defines marketing campaigns that group leads and contact activities.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| **id** | String | PK, default: `cuid()` | Unique identifier |
| **name** | String | Required | Campaign name |
| **description** | String? | Optional | Campaign description |
| **status** | String | Default: `"DRAFT"`, Indexed | DRAFT, ACTIVE, PAUSED, COMPLETED |
| **channels** | String | Default: `"[]"` | JSON array: ["CALL", "SMS", "EMAIL"] |
| **meta** | String? | Optional | JSON metadata |
| **startDate** | DateTime? | Optional | Campaign start date |
| **endDate** | DateTime? | Optional | Campaign end date |
| **createdAt** | DateTime | Default: `now()` | Record creation timestamp |
| **updatedAt** | DateTime | Auto-updated | Last modification timestamp |

**Relations**:
- `campaignLeads[]` → CampaignLead (1-to-many)
- `scripts[]` → Script (1-to-many)
- `contactAttempts[]` → ContactAttempt (1-to-many)
- `abTests[]` → ABTest (1-to-many)
- `conversions[]` → Conversion (1-to-many)

**Indexes**:
- `status_idx` (status)

### CampaignLead
Junction table linking leads to campaigns.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| **id** | String | PK, default: `cuid()` | Unique identifier |
| **campaignId** | String | FK→Campaign, Indexed | Campaign reference |
| **leadId** | String | FK→Lead, Indexed | Lead reference |
| **status** | String | Default: `"PENDING"` | PENDING, IN_PROGRESS, COMPLETED, FAILED |
| **assignedAt** | DateTime | Default: `now()` | When lead was assigned to campaign |
| **completedAt** | DateTime? | Optional | When campaign completed for this lead |

**Relations**:
- `campaign` → Campaign (many-to-one)
- `lead` → Lead (many-to-one)

**Constraints**:
- Unique: `(campaignId, leadId)` — prevents duplicate assignments

**Indexes**:
- `campaignId_idx` (campaignId)
- `leadId_idx` (leadId)
- `campaignId_leadId_unique_idx` (campaignId, leadId)

**Cascade Delete**: Both FK deletes CASCADE

---

## Contact & Communication

### Script
Templates for multi-channel communication (call scripts, SMS, email templates).

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| **id** | String | PK, default: `cuid()` | Unique identifier |
| **name** | String | Required | Script name (e.g., "Welcome Call Script") |
| **type** | String | Required, Indexed | CALL, SMS, EMAIL |
| **content** | String? | Optional | Template text, supports `{{firstName}}` placeholders |
| **vapiConfig** | String? | Optional | JSON config for VAPI (call provider) |
| **campaignId** | String? | Optional, Indexed, FK | Associated campaign |
| **isDefault** | Boolean | Default: `false` | Is this a default/system script? |
| **createdAt** | DateTime | Default: `now()` | Record creation timestamp |
| **updatedAt** | DateTime | Auto-updated | Last modification timestamp |

**Relations**:
- `campaign` → Campaign (many-to-one, optional)
- `contactAttempts[]` → ContactAttempt (1-to-many)
- `sequenceSteps[]` → SequenceStep (1-to-many)

**Indexes**:
- `campaignId_idx` (campaignId)
- `type_idx` (type)

**VAPI Config Structure** (example):
```json
{
  "model": "gpt-4o",
  "voice": "alloy",
  "temperature": 0.7,
  "firstMessage": "Hello! This is Alex...",
  "instructions": "You are Alex, a friendly sales representative..."
}
```

### ContactAttempt
Tracks individual contact attempts (calls, SMS, emails) made to leads.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| **id** | String | PK, default: `cuid()` | Unique identifier |
| **leadId** | String | Required, FK, Indexed | Lead reference |
| **campaignId** | String? | Optional, FK, Indexed | Campaign (if associated) |
| **channel** | String | Required, Indexed | CALL, SMS, EMAIL |
| **status** | String | Default: `"PENDING"` | PENDING, SUCCESS, NO_ANSWER, IN_PROGRESS, FAILED |
| **scriptId** | String? | Optional, FK | Script used for this attempt |
| **provider** | String? | Optional | Provider name (vapi, twilio, sendgrid) |
| **providerRef** | String? | Optional | Provider's reference ID |
| **startedAt** | DateTime | Default: `now()` | When attempt was initiated |
| **completedAt** | DateTime? | Optional | When attempt completed |
| **duration** | Int? | Optional | Call duration in seconds |
| **cost** | Float? | Optional | Cost of this attempt |
| **result** | String? | Optional | Result details |
| **notes** | String? | Optional | Free-form notes |

**Relations**:
- `lead` → Lead (many-to-one)
- `campaign` → Campaign (many-to-one, optional)
- `script` → Script (many-to-one, optional)
- `stepExecutions[]` → SequenceStepExecution (1-to-many)
- `conversions[]` → Conversion (1-to-many)

**Indexes**:
- `leadId_idx` (leadId)
- `channel_idx` (channel)
- `campaignId_idx` (campaignId)

**Cascade Delete**: Lead delete CASCADE, Campaign/Script delete SET NULL

### IntegrationConfig
Stores configuration for external service integrations.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| **id** | String | PK, default: `cuid()` | Unique identifier |
| **provider** | String | Required, Unique, Indexed | Provider name (vapi, twilio, sendgrid) |
| **type** | String | Required | Integration type (CALL, SMS, EMAIL) |
| **config** | String | Default: `"{}"` | JSON config (credentials, API keys, webhooks) |
| **isActive** | Boolean | Default: `true` | Is this integration enabled? |
| **createdAt** | DateTime | Default: `now()` | Record creation timestamp |
| **updatedAt** | DateTime | Auto-updated | Last modification timestamp |

**Indexes**:
- `provider_unique_idx` (provider)

**Config Structure Examples**:
```json
// VAPI (Calls)
{
  "apiKey": "vapi_test_key_xxx",
  "baseUrl": "https://api.vapi.ai",
  "webhookUrl": "https://yourapp.com/api/webhooks/vapi"
}

// Twilio (SMS)
{
  "accountSid": "AC_test_xxx",
  "authToken": "test_auth_token_xxx",
  "fromNumber": "+15559990000",
  "webhookUrl": "https://yourapp.com/api/webhooks/sms"
}

// SendGrid (Email)
{
  "apiKey": "sg_test_xxx",
  "fromEmail": "noreply@yourapp.com",
  "webhookUrl": "https://yourapp.com/api/webhooks/email"
}
```

---

## Retention Sequences

Automated, multi-step sequences for retaining and re-engaging leads.

### RetentionSequence
Defines an automated retention/re-engagement sequence.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| **id** | String | PK, default: `cuid()` | Unique identifier |
| **name** | String | Required | Sequence name |
| **description** | String? | Optional | Sequence description |
| **status** | String | Default: `"DRAFT"`, Indexed | DRAFT, ACTIVE, PAUSED, ARCHIVED |
| **channels** | String | Default: `"[]"` | JSON array: ["CALL", "SMS", "EMAIL"] |
| **triggerType** | String | Default: `"manual"`, Indexed | manual, new_lead, no_conversion |
| **triggerConfig** | String | Default: `"{}"` | JSON trigger configuration |
| **createdAt** | DateTime | Default: `now()` | Record creation timestamp |
| **updatedAt** | DateTime | Auto-updated | Last modification timestamp |

**Relations**:
- `steps[]` → SequenceStep (1-to-many)
- `enrollments[]` → SequenceEnrollment (1-to-many)

**Indexes**:
- `status_idx` (status)
- `triggerType_idx` (triggerType)

**Trigger Config Structure** (examples):
```json
// New lead trigger
{
  "sources": ["META", "API"],
  "campaigns": ["campaign_id_1", "campaign_id_2"]
}

// No conversion trigger
{
  "minDaysSinceLastContact": 7,
  "excludeStatus": ["CONVERTED", "LOST"]
}
```

### SequenceStep
Individual step within a retention sequence.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| **id** | String | PK, default: `cuid()` | Unique identifier |
| **sequenceId** | String | Required, FK, Indexed | RetentionSequence reference |
| **stepOrder** | Int | Required, Indexed | Step number (0, 1, 2, ...) |
| **channel** | String | Required | EMAIL, SMS, CALL |
| **scriptId** | String? | Optional, FK | Script template to use |
| **delayValue** | Int | Default: `0` | Number of delay units |
| **delayUnit** | String | Default: `"HOURS"` | HOURS, DAYS, WEEKS |
| **conditions** | String | Default: `"{}"` | JSON conditions (e.g., "only if not converted") |
| **isActive** | Boolean | Default: `true` | Is this step enabled? |
| **createdAt** | DateTime | Default: `now()` | Record creation timestamp |
| **updatedAt** | DateTime | Auto-updated | Last modification timestamp |

**Relations**:
- `sequence` → RetentionSequence (many-to-one)
- `script` → Script (many-to-one, optional)
- `executions[]` → SequenceStepExecution (1-to-many)

**Indexes**:
- `sequenceId_idx` (sequenceId)
- `stepOrder_idx` (stepOrder)

**Cascade Delete**: RetentionSequence delete CASCADE, Script delete SET NULL

### SequenceEnrollment
Tracks which leads are enrolled in which sequences.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| **id** | String | PK, default: `cuid()` | Unique identifier |
| **sequenceId** | String | Required, FK, Indexed | RetentionSequence reference |
| **leadId** | String | Required, FK, Indexed | Lead reference |
| **status** | String | Default: `"ACTIVE"`, Indexed | ACTIVE, PAUSED, COMPLETED, CANCELLED, CONVERTED |
| **currentStep** | Int | Default: `0` | Which step the lead is on |
| **enrolledAt** | DateTime | Default: `now()` | When lead was enrolled |
| **completedAt** | DateTime? | Optional | When sequence was completed |
| **lastStepAt** | DateTime? | Optional | When last step was executed |
| **meta** | String | Default: `"{}"` | JSON metadata for tracking |

**Relations**:
- `sequence` → RetentionSequence (many-to-one)
- `lead` → Lead (many-to-one)
- `executions[]` → SequenceStepExecution (1-to-many)

**Constraints**:
- Unique: `(sequenceId, leadId)` — prevents duplicate enrollments

**Indexes**:
- `sequenceId_idx` (sequenceId)
- `status_idx` (status)
- `leadId_idx` (leadId)
- `sequenceId_leadId_unique_idx` (sequenceId, leadId)

**Cascade Delete**: Both FK deletes CASCADE

### SequenceStepExecution
Tracks execution of individual steps for enrolled leads.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| **id** | String | PK, default: `cuid()` | Unique identifier |
| **enrollmentId** | String | Required, FK, Indexed | SequenceEnrollment reference |
| **stepId** | String | Required, FK, Indexed | SequenceStep reference |
| **contactAttemptId** | String? | Optional, FK | Associated ContactAttempt |
| **status** | String | Default: `"PENDING"`, Indexed | PENDING, SCHEDULED, SENT, DELIVERED, FAILED, SKIPPED |
| **scheduledAt** | DateTime? | Optional, Indexed | When step is scheduled to execute |
| **executedAt** | DateTime? | Optional | When step actually executed |
| **result** | String | Default: `"{}"` | JSON execution result |

**Relations**:
- `enrollment` → SequenceEnrollment (many-to-one)
- `step` → SequenceStep (many-to-one)
- `contactAttempt` → ContactAttempt (many-to-one, optional)

**Indexes**:
- `enrollmentId_idx` (enrollmentId)
- `stepId_idx` (stepId)
- `status_idx` (status)
- `scheduledAt_idx` (scheduledAt) — for scheduling queries

**Cascade Delete**: Enrollment/Step delete CASCADE, ContactAttempt delete SET NULL

**Result Structure** (example):
```json
{
  "provider": "sendgrid",
  "providerRef": "sg_msg_001",
  "openedAt": "2026-02-18T14:30:00Z",
  "clickedAt": null,
  "bounced": false
}
```

---

## Conversions & Analytics

### Conversion
Tracks conversions linked to leads, campaigns, or specific contact attempts.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| **id** | String | PK, default: `cuid()` | Unique identifier |
| **leadId** | String? | Optional, FK, Indexed | Lead reference |
| **campaignId** | String? | Optional, FK, Indexed | Campaign reference |
| **channel** | String? | Optional | Channel where conversion occurred |
| **revenue** | Float | Default: `0` | Conversion value/revenue |
| **status** | String | Default: `"lead"` | lead, qualified, customer, churn |
| **subId** | String? | Optional, Indexed | Tracking subId (for deduplication) |
| **clickId** | String? | Optional, Indexed | Tracking clickId |
| **source** | String | Default: `"keitaro"` | Source (keitaro postback, direct, etc.) |
| **postbackData** | String? | Optional | Raw postback data as JSON |
| **contactAttemptId** | String? | Optional, FK | Associated ContactAttempt |
| **createdAt** | DateTime | Default: `now()` | When conversion was recorded |

**Relations**:
- `lead` → Lead (many-to-one, optional)
- `campaign` → Campaign (many-to-one, optional)
- `contactAttempt` → ContactAttempt (many-to-one, optional)

**Indexes**:
- `leadId_idx` (leadId)
- `campaignId_idx` (campaignId)
- `subId_idx` (subId)
- `clickId_idx` (clickId)
- `source_idx` (source)

**Cascade Delete**: All FK deletes SET NULL

### ConversionRule
Defines rules/metrics for tracking conversions.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| **id** | String | PK, default: `cuid()` | Unique identifier |
| **channel** | String | Required, Indexed | CALL, SMS, EMAIL |
| **metric** | String | Required, Indexed | Metric name (e.g., "demo_booked") |
| **value** | String | Required | Metric value or condition |
| **conversionRate** | Float | Default: `0` | Calculated conversion rate (0-1) |
| **sampleSize** | Int | Default: `0` | Number of samples used |
| **confidence** | Float | Default: `0` | Statistical confidence (0-1) |
| **createdAt** | DateTime | Default: `now()` | Record creation timestamp |
| **updatedAt** | DateTime | Auto-updated | Last modification timestamp |

**Indexes**:
- `channel_idx` (channel)
- `metric_idx` (metric)

### ABTest
A/B testing for multi-variant campaign testing.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| **id** | String | PK, default: `cuid()` | Unique identifier |
| **campaignId** | String | Required, FK, Indexed | Campaign being tested |
| **channel** | String | Required | CALL, SMS, EMAIL |
| **variantA** | String | Required | Variant A content/script |
| **variantB** | String | Required | Variant B content/script |
| **status** | String | Default: `"RUNNING"`, Indexed | RUNNING, PAUSED, COMPLETED |
| **winnerId** | String? | Optional | ID of winning variant (A or B) |
| **startedAt** | DateTime | Default: `now()` | Test start timestamp |
| **endedAt** | DateTime? | Optional | Test end timestamp |
| **statsA** | String | Default: `"{}"` | JSON stats for variant A |
| **statsB** | String | Default: `"{}"` | JSON stats for variant B |

**Relations**:
- `campaign` → Campaign (many-to-one)

**Indexes**:
- `campaignId_idx` (campaignId)
- `status_idx` (status)

**Cascade Delete**: Campaign delete CASCADE

**Stats Structure** (example):
```json
{
  "impressions": 150,
  "clicks": 35,
  "conversions": 8,
  "revenue": 2400.00,
  "ctr": 0.233,
  "conversionRate": 0.053,
  "roas": 3.2
}
```

---

## Integration Config

### IntegrationConfig (Detailed)

See [Contact & Communication section](#integrationconfig) above for full details.

**Supported Providers**:
- `vapi` — AI voice calls (VAPI provider)
- `twilio` — SMS messaging
- `sendgrid` — Email delivery

---

## Relationships

### Relationship Diagram

```
Lead (1) ──────────┬─────────→ CampaignLead (many) ←─────────┬─────── Campaign (1)
  │                │                                            │
  ├─→ ContactAttempt (many)                              ├─→ Script (many)
  │                                                        ├─→ ABTest (many)
  ├─→ SequenceEnrollment (many)                          ├─→ Conversion (many)
  │   └─→ SequenceStep (many)
  │       └─→ SequenceStepExecution (many) ──→ ContactAttempt
  │
  └─→ Conversion (many)

ContactAttempt (many) ───→ Script (1)
                      ───→ Campaign (1, optional)
                      ───→ Lead (1)

RetentionSequence (1) ──┬─→ SequenceStep (many) ──→ Script (optional)
                        │
                        └─→ SequenceEnrollment (many) ──┬─→ Lead (1)
                            └─→ SequenceStepExecution (many)
```

### Key Foreign Key Constraints

| From | To | Delete Behavior | Notes |
|------|----|----|-------|
| CampaignLead → Campaign | Campaign | CASCADE | Delete campaign → delete assignments |
| CampaignLead → Lead | Lead | CASCADE | Delete lead → delete assignments |
| Script → Campaign | Campaign | SET NULL | Delete campaign → orphan scripts |
| ContactAttempt → Lead | Lead | CASCADE | Delete lead → delete attempts |
| ContactAttempt → Campaign | Campaign | SET NULL | Delete campaign → orphan attempts |
| ContactAttempt → Script | Script | SET NULL | Delete script → orphan attempts |
| SequenceStep → RetentionSequence | RetentionSequence | CASCADE | Delete sequence → delete steps |
| SequenceStep → Script | Script | SET NULL | Delete script → orphan steps |
| SequenceEnrollment → RetentionSequence | RetentionSequence | CASCADE | Delete sequence → delete enrollments |
| SequenceEnrollment → Lead | Lead | CASCADE | Delete lead → delete enrollments |
| SequenceStepExecution → SequenceEnrollment | SequenceEnrollment | CASCADE | Delete enrollment → delete executions |
| SequenceStepExecution → SequenceStep | SequenceStep | CASCADE | Delete step → delete executions |
| SequenceStepExecution → ContactAttempt | ContactAttempt | SET NULL | Delete attempt → orphan execution |
| ABTest → Campaign | Campaign | CASCADE | Delete campaign → delete tests |
| Conversion → Lead | Lead | SET NULL | Delete lead → orphan conversions |
| Conversion → Campaign | Campaign | SET NULL | Delete campaign → orphan conversions |
| Conversion → ContactAttempt | ContactAttempt | SET NULL | Delete attempt → orphan conversions |

---

## Indexes

### All Indexes

| Table | Column(s) | Type | Purpose |
|-------|-----------|------|---------|
| Lead | email | Index | Email lookup, deduplication |
| Lead | phone | Index | Phone lookup, deduplication |
| Lead | status | Index | Filter by status (NEW, CONTACTED, etc.) |
| CampaignLead | (campaignId, leadId) | Unique | Prevent duplicate assignments |
| CampaignLead | campaignId | Index | Find all leads in campaign |
| CampaignLead | leadId | Index | Find all campaigns for lead |
| Campaign | status | Index | Filter campaigns by status |
| Script | campaignId | Index | Find scripts by campaign |
| Script | type | Index | Find scripts by type (CALL/SMS/EMAIL) |
| ContactAttempt | leadId | Index | Find attempts for lead |
| ContactAttempt | channel | Index | Filter attempts by channel |
| ContactAttempt | campaignId | Index | Find attempts in campaign |
| IntegrationConfig | provider | Unique | Ensure single config per provider |
| Conversion | leadId | Index | Find conversions by lead |
| Conversion | campaignId | Index | Find conversions by campaign |
| Conversion | subId | Index | Tracking deduplication |
| Conversion | clickId | Index | Tracking deduplication |
| Conversion | source | Index | Filter by source |
| ConversionRule | channel | Index | Find rules by channel |
| ConversionRule | metric | Index | Find rules by metric |
| ABTest | campaignId | Index | Find tests for campaign |
| ABTest | status | Index | Filter tests by status |
| RetentionSequence | status | Index | Filter sequences by status |
| RetentionSequence | triggerType | Index | Filter by trigger type |
| SequenceStep | sequenceId | Index | Find steps in sequence |
| SequenceStep | stepOrder | Index | Order steps chronologically |
| SequenceEnrollment | (sequenceId, leadId) | Unique | Prevent duplicate enrollments |
| SequenceEnrollment | sequenceId | Index | Find enrollments in sequence |
| SequenceEnrollment | status | Index | Filter by enrollment status |
| SequenceEnrollment | leadId | Index | Find sequences for lead |
| SequenceStepExecution | enrollmentId | Index | Find executions for enrollment |
| SequenceStepExecution | stepId | Index | Find executions for step |
| SequenceStepExecution | status | Index | Filter by execution status |
| SequenceStepExecution | scheduledAt | Index | Query scheduled steps (job queue) |

---

## Migration History

**Initial Migration**: `20260218183952_init`
- Created all core tables (Lead, Campaign, CampaignLead, Script, ContactAttempt, IntegrationConfig)
- Created conversion and analytics tables (Conversion, ConversionRule, ABTest)
- Created retention sequence tables (RetentionSequence, SequenceStep, SequenceEnrollment, SequenceStepExecution)
- All foreign key constraints and cascade deletes configured
- All indexes created for query performance

---

## Data Types & Enums

### Status Fields

**Lead.status**:
- `NEW` — First contact, not yet reached
- `CONTACTED` — Lead has been contacted
- `IN_PROGRESS` — Active engagement
- `CONVERTED` — Lead became customer
- `LOST` — Lead disqualified or unresponsive

**Campaign.status**:
- `DRAFT` — Not yet active
- `ACTIVE` — Currently running
- `PAUSED` — Temporarily stopped
- `COMPLETED` — Campaign ended

**CampaignLead.status**:
- `PENDING` — Not yet started
- `IN_PROGRESS` — Currently working
- `COMPLETED` — Campaign complete for this lead
- `FAILED` — Campaign failed for this lead

**ContactAttempt.status**:
- `PENDING` — Queued, not yet attempted
- `IN_PROGRESS` — Currently being executed
- `SUCCESS` — Completed successfully
- `NO_ANSWER` — Call/contact went unanswered
- `FAILED` — Attempt failed

**Conversion.status**:
- `lead` — Initial lead status
- `qualified` — Lead qualified
- `customer` — Paying customer
- `churn` — Customer churned

**SequenceEnrollment.status**:
- `ACTIVE` — Currently in sequence
- `PAUSED` — Temporarily paused
- `COMPLETED` — Finished all steps
- `CANCELLED` — Manually cancelled
- `CONVERTED` — Lead converted, sequence stopped

**SequenceStepExecution.status**:
- `PENDING` — Waiting to be scheduled
- `SCHEDULED` — Scheduled for later execution
- `SENT` — Sent to provider
- `DELIVERED` — Confirmed delivery
- `FAILED` — Execution failed
- `SKIPPED` — Step was skipped

**RetentionSequence.status**:
- `DRAFT` — Not active
- `ACTIVE` — Currently running
- `PAUSED` — Temporarily paused
- `ARCHIVED` — No longer in use

**RetentionSequence.triggerType**:
- `manual` — Manual enrollment only
- `new_lead` — Trigger on new lead creation
- `no_conversion` — Trigger when lead hasn't converted

### Channel Types

- `CALL` — Voice call via VAPI
- `SMS` — Text message via Twilio
- `EMAIL` — Email via SendGrid

### Source Types

**Lead.source** (where lead came from):
- `MANUAL` — Manually added
- `META` — From Meta/Facebook ad platform
- `API` — Via API integration

**Conversion.source** (conversion tracking):
- `keitaro` — From Keitaro tracker postback
- `direct` — Direct tracking
- Other custom sources

### Script Types

- `CALL` — Voice call script (uses vapiConfig)
- `SMS` — SMS message template
- `EMAIL` — Email template (subject + HTML body)

---

## Database Connection

**Configuration File**: `prisma.config.ts`

```typescript
{
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts"
  },
  datasource: {
    url: process.env.DATABASE_URL || `file:./dev.db`
  }
}
```

**Environment Variable**: `DATABASE_URL=file:./dev.db`

**Adapter**: libsql (SQLite adapter)

**Client Output**: `src/generated/prisma/client`

---

## Seeding

**Seed Script**: `prisma/seed.ts`

Creates sample data:
- **20 Leads** with various statuses and sources
- **3 Campaigns** (Spring Outreach, Re-engagement, Holiday)
- **3 Scripts** (Call, SMS, Email)
- **16 ContactAttempts** across various channels and statuses
- **2 IntegrationConfigs** (VAPI for calls, Twilio for SMS)

Run with: `npx prisma db seed`

---

## Query Performance Tips

1. **Filter by Status**: Use `@@index([status])` for fast status-based queries
2. **Lead Lookups**: Use indexed `email` or `phone` for fast deduplication
3. **Campaign Context**: Use `campaignId` indexes on ContactAttempt and CampaignLead
4. **Sequence Scheduling**: Use `scheduledAt` index on SequenceStepExecution for job queue
5. **Bulk Inserts**: Use `createMany()` for ContactAttempt, SequenceStepExecution
6. **Deduplication**: Use unique constraints on (campaignId, leadId) and (sequenceId, leadId)
7. **Tracking**: Use `subId` and `clickId` indexes for conversion deduplication

---

## Important Notes

- **JSON Fields**: Several fields store JSON (channels, meta, triggerConfig, vapiConfig, conditions, result, stats, postbackData). Parse/stringify in application code.
- **Timestamps**: All `createdAt` use `default: now()`, all `updatedAt` auto-sync via Prisma
- **CUID IDs**: All primary keys use CUID (collision-resistant unique identifiers)
- **Optional ForeignKeys**: Script and Campaign are optional on ContactAttempt and Script; CASCADE behavior varies per relation
- **Cascade Deletes**: Careful when deleting campaigns, leads, or sequences — will cascade to related records
- **Unique Constraints**: (campaignId, leadId) and (sequenceId, leadId) prevent duplicates
