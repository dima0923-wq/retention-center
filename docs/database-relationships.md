# Retention Center — Database Relationships & Query Patterns

Last Updated: 2026-02-21

## Overview

Retention Center uses **SQLite with Prisma ORM**. The database schema comprises 13 models organized in 4 functional domains:

1. **Lead Management** (Lead, CampaignLead, ContactAttempt)
2. **Campaign Management** (Campaign, Script)
3. **Conversion Tracking** (Conversion, ConversionRule)
4. **Retention Sequences** (RetentionSequence, SequenceStep, SequenceEnrollment, SequenceStepExecution)
5. **Integration Config** (IntegrationConfig for third-party providers)

---

## 1. CORE MODELS & RELATIONSHIPS

### 1.1 Lead Model
**Purpose:** Central entity representing contacts to be reached.

```
Model: Lead
├─ id: String (cuid)
├─ externalId: String? (from CRM systems)
├─ firstName, lastName, phone, email
├─ source: String (MANUAL, UPLOAD, API, CRM, etc.)
├─ status: String (NEW, CONTACTED, IN_PROGRESS, CONVERTED, DO_NOT_CONTACT)
├─ meta: String? (JSON for custom fields)
├─ notes: String?
├─ createdAt, updatedAt: DateTime
```

**Indexes:**
- `@@index([email])` — Deduplication, bulk lookups
- `@@index([phone])` — SMS/call routing
- `@@index([status])` — Filtering by lead status

**Relations:**
- `campaignLeads: CampaignLead[]` — Many campaigns per lead
- `contactAttempts: ContactAttempt[]` — All contact history
- `sequenceEnrollments: SequenceEnrollment[]` — Active/completed sequences
- `conversions: Conversion[]` — Conversion events

**Key Queries:**
```ts
// Deduplication on create
prisma.lead.findFirst({ where: { OR: [{ email }, { phone }] } })

// List with filters & pagination
prisma.lead.findMany({
  where: { status, source, createdAt: {gte, lte},
           OR: [{ firstName contains }, { email contains }, ...] },
  orderBy: { [safeSort]: sortOrder },
  skip, take
})

// Stats by status/source
prisma.lead.groupBy({
  by: ["status"], _count: true
})
```

---

### 1.2 Campaign Model
**Purpose:** Container for contact campaigns (multi-channel, multi-step).

```
Model: Campaign
├─ id: String (cuid)
├─ name: String
├─ description: String?
├─ status: String (DRAFT, ACTIVE, PAUSED, COMPLETED)
├─ channels: String (JSON array: ["EMAIL", "SMS", "CALL"])
├─ meta: String? (JSON—see below)
├─ startDate, endDate: DateTime?
├─ createdAt, updatedAt
```

**Meta Fields (JSON):**
- `instantlySync: boolean` — Synced to Instantly.ai
- `instantlyCampaignId: string` — Instantly campaign ID for lead sync
- `emailSequence: string[]` — Ordered email templates
- `contactHoursStart/End: string` — Time-of-day rate limiting
- `contactDays: string[]` — Days of week for contact (["MON", "TUE", ...])
- `maxContactsPerDay: number` — Rate limit per lead
- `delayBetweenChannels: number` — Milliseconds between channel attempts
- `autoAssign: boolean` — Auto-route new leads
- `vapiConfig: object` — VAPI call script overrides

**Indexes:**
- `@@index([status])` — Status filtering

**Relations:**
- `campaignLeads: CampaignLead[]` — Leads in this campaign
- `scripts: Script[]` — Campaign-specific scripts
- `contactAttempts: ContactAttempt[]` — All attempt history
- `abTests: ABTest[]` — A/B tests for this campaign
- `conversions: Conversion[]` — Conversions from this campaign

**Status Transitions:**
```
DRAFT → ACTIVE → PAUSED → COMPLETED
DRAFT → ACTIVE
ACTIVE → PAUSED, COMPLETED
PAUSED → ACTIVE, COMPLETED
```

**Key Queries:**
```ts
// Get with nested relationships
prisma.campaign.findUnique({
  where: { id },
  include: {
    campaignLeads: { include: { lead: true }, orderBy: { assignedAt: "desc" } },
    scripts: true,
    _count: { select: { campaignLeads: true } }
  }
})

// List with search
prisma.campaign.findMany({
  where: { status, createdAt: {gte, lte},
           OR: [{ name: {contains} }, { description: {contains} }] },
  orderBy: { [sortBy]: sortOrder },
  skip, take,
  include: { _count: { select: { campaignLeads: true } } }
})

// Stats: groupBy status and channel
prisma.campaignLead.groupBy({
  by: ["status"],
  where: { campaignId: id },
  _count: true
})

prisma.contactAttempt.groupBy({
  by: ["channel"],
  where: { campaignId: id },
  _count: true
})
```

---

### 1.3 CampaignLead Model
**Purpose:** Junction table linking leads to campaigns; tracks assignment status.

```
Model: CampaignLead
├─ id: String (cuid)
├─ campaignId: String @relation(Campaign)
├─ leadId: String @relation(Lead)
├─ status: String (PENDING, CONTACTED, COMPLETED)
├─ assignedAt: DateTime
└─ completedAt: DateTime?
```

**Unique Constraint:**
- `@@unique([campaignId, leadId])` — Prevents duplicate assignments

**Indexes:**
- `@@index([campaignId])`
- `@@index([leadId])`

**Cascade Behavior:**
- `onDelete: Cascade` — Deleting campaign/lead cascades to CampaignLead

**Key Queries:**
```ts
// Bulk assign leads (with deduplication check)
const existing = await prisma.campaignLead.findMany({
  where: { campaignId, leadId: { in: leadIds } },
  select: { leadId: true }
})
const newLeadIds = leadIds.filter(id => !existingIds.has(id))
await prisma.campaignLead.createMany({
  data: newLeadIds.map(leadId => ({ campaignId, leadId }))
})

// Bulk remove leads
prisma.campaignLead.deleteMany({
  where: { campaignId, leadId: { in: leadIds } }
})

// List leads in campaign (paginated)
prisma.campaignLead.findMany({
  where: { campaignId },
  include: { lead: true },
  orderBy: { assignedAt: "desc" },
  skip, take
})

// Campaign completion stats
prisma.campaignLead.groupBy({
  by: ["status"],
  where: { campaignId: id },
  _count: true
})
```

---

### 1.4 ContactAttempt Model
**Purpose:** Logs all contact attempts (SMS, EMAIL, CALL) across channels.

```
Model: ContactAttempt
├─ id: String (cuid)
├─ leadId: String @relation(Lead, onDelete: Cascade)
├─ campaignId: String? @relation(Campaign, onDelete: SetNull)
├─ channel: String (EMAIL, SMS, CALL, WEBHOOK)
├─ status: String (PENDING, SENT, DELIVERED, SUCCESS, FAILED, BOUNCED)
├─ scriptId: String? @relation(Script, onDelete: SetNull)
├─ provider: String? (instantly, twilio, vapi, etc.)
├─ providerRef: String? (external API ID)
├─ startedAt, completedAt: DateTime
├─ duration: Int? (seconds for calls)
├─ cost: Float? (Twilio/VAPI charges)
├─ result: String? (JSON—provider-specific response)
└─ notes: String?
```

**Indexes:**
- `@@index([leadId])`
- `@@index([channel])`
- `@@index([campaignId])`

**Result JSON Format (examples):**
- EMAIL: `{ "opened": true, "clicked": true, "replied": true, "bounced": false }`
- SMS: `{ "status": "delivered", "segments": 1 }`
- CALL: `{ "duration": 120, "outcome": "answered", "recordingUrl": "..." }`

**Key Queries:**
```ts
// List with pagination & filters
prisma.contactAttempt.findMany({
  where: {
    ...(status && { status }),
    ...(channel && { channel }),
    ...(campaignId && { campaignId }),
    ...(dateRange && { startedAt: {gte, lte} })
  },
  orderBy: { startedAt: "desc" },
  take: limit, skip
})

// Get lead with attempt history
prisma.lead.findUnique({
  where: { id },
  include: {
    contactAttempts: { orderBy: { startedAt: "desc" } }
  }
})

// Channel performance stats
prisma.contactAttempt.groupBy({
  by: ["channel", "status"],
  where: { startedAt: {gte, lte} },
  _count: true,
  _avg: { duration: true, cost: true }
})

// Success rate by channel
prisma.contactAttempt.count({
  where: { channel: "EMAIL", status: "SUCCESS" }
})
```

---

### 1.5 Script Model
**Purpose:** Reusable templates for contact messages (email, SMS, call IVR).

```
Model: Script
├─ id: String (cuid)
├─ name: String
├─ type: String (EMAIL, SMS, CALL, WEBHOOK)
├─ content: String? (template with {{placeholders}})
├─ vapiConfig: String? (JSON for VAPI call routing)
├─ campaignId: String? @relation(Campaign, onDelete: SetNull)
├─ isDefault: Boolean
├─ createdAt, updatedAt
```

**Indexes:**
- `@@index([campaignId])`
- `@@index([type])` — Find scripts by type

**Relations:**
- `campaign: Campaign?` — Optional campaign scope
- `contactAttempts: ContactAttempt[]` — Attempts using this script
- `sequenceSteps: SequenceStep[]` — Steps using this script

**Key Queries:**
```ts
// Get all scripts of a type
prisma.script.findMany({
  where: { type: "EMAIL" },
  orderBy: { createdAt: "desc" }
})

// Get campaign-specific scripts
prisma.script.findMany({
  where: { campaignId }
})

// Get default scripts
prisma.script.findMany({
  where: { isDefault: true }
})
```

---

## 2. CONVERSION TRACKING MODELS

### 2.1 Conversion Model
**Purpose:** Records conversion events (sales, sign-ups) from Keitaro or other sources.

```
Model: Conversion
├─ id: String (cuid)
├─ leadId: String? @relation(Lead, onDelete: SetNull)
├─ campaignId: String? @relation(Campaign, onDelete: SetNull)
├─ channel: String? (where conversion occurred)
├─ revenue: Float (conversion value)
├─ status: String (lead, sale, signup, trial, etc.)
├─ subId: String? (Keitaro campaign subid)
├─ clickId: String? (Keitaro click ID)
├─ source: String (keitaro, webhook, manual, etc.)
├─ postbackData: String? (JSON—raw Keitaro postback)
├─ contactAttemptId: String? @relation(ContactAttempt, onDelete: SetNull)
└─ createdAt: DateTime
```

**Indexes:**
- `@@index([leadId])` — Conversions per lead
- `@@index([campaignId])` — Conversions per campaign
- `@@index([subId])` — Keitaro link tracking
- `@@index([clickId])` — Click tracing
- `@@index([source])` — Source filtering

**Keitaro Postback Flow:**
```
Keitaro → POST /api/webhooks/keitaro
  { sub_id, click_id, status, revenue, ... }
  → Create/link Conversion
  → Update Lead status to CONVERTED
  → Mark SequenceEnrollments as CONVERTED
```

**Key Queries:**
```ts
// List conversions with filters
prisma.conversion.findMany({
  where: {
    ...(campaignId && { campaignId }),
    ...(status && { status }),
    ...(dateRange && { createdAt: {gte, lte} })
  },
  orderBy: { createdAt: "desc" },
  take, skip
})

// Revenue by campaign
prisma.conversion.aggregate({
  _sum: { revenue: true },
  where: { campaignId }
})

// Conversion count for lead
prisma.conversion.count({
  where: { leadId }
})

// Check if lead has conversions (for "no_conversion" sequence trigger)
const hasConversion = await prisma.conversion.count({
  where: { leadId }
}) > 0
```

---

### 2.2 ConversionRule Model
**Purpose:** Statistical rules for conversion attribution (confidence, sample size).

```
Model: ConversionRule
├─ id: String (cuid)
├─ channel: String
├─ metric: String (ctr, cpc, roas, etc.)
├─ value: String (threshold value)
├─ conversionRate: Float
├─ sampleSize: Int (data point count)
├─ confidence: Float (0.0-1.0)
├─ createdAt, updatedAt
```

**Indexes:**
- `@@index([channel])`
- `@@index([metric])`

*(Limited usage—mostly for analytics and rule-based routing)*

---

## 3. RETENTION SEQUENCE MODELS

### 3.1 RetentionSequence Model
**Purpose:** Defines multi-step, multi-channel retention workflows.

```
Model: RetentionSequence
├─ id: String (cuid)
├─ name: String
├─ description: String?
├─ status: String (DRAFT, ACTIVE, PAUSED, ARCHIVED)
├─ channels: String (JSON: ["EMAIL", "SMS", "CALL"])
├─ triggerType: String (manual, new_lead, no_conversion)
├─ triggerConfig: String (JSON—trigger filters)
├─ createdAt, updatedAt
```

**Trigger Types:**
- `manual` — Enroll leads manually via API
- `new_lead` — Auto-enroll leads created since last check (with lookback window)
- `no_conversion` — Auto-enroll leads older than minAgeHours with no conversions

**Trigger Config (JSON):**
```json
{
  "lookbackMinutes": 15,
  "source": "API",
  "status": "NEW",
  "minAgeHours": 24
}
```

**Status Transitions:**
```
DRAFT → ACTIVE → PAUSED → ARCHIVED
DRAFT → ACTIVE
ACTIVE → PAUSED, ARCHIVED
PAUSED → ACTIVE, ARCHIVED
```

**Indexes:**
- `@@index([status])`
- `@@index([triggerType])`

**Relations:**
- `steps: SequenceStep[]` — Ordered steps in sequence
- `enrollments: SequenceEnrollment[]` — Lead enrollments

**Key Queries:**
```ts
// Get active sequences with steps
prisma.retentionSequence.findMany({
  where: { status: "ACTIVE", triggerType: { in: ["new_lead", "no_conversion"] } },
  include: {
    steps: { where: { isActive: true }, orderBy: { stepOrder: "asc" } }
  }
})

// Get sequence with stats
prisma.retentionSequence.findUnique({
  where: { id },
  include: {
    steps: { orderBy: { stepOrder: "asc" },
             include: { script: { select: { id, name, type } } } },
    _count: { select: { enrollments: true } }
  }
})

// Enrollment breakdown
prisma.sequenceEnrollment.groupBy({
  by: ["status"],
  where: { sequenceId: id },
  _count: true
})

// Validate transition before update
const allowed = VALID_STATUS_TRANSITIONS[existing.status] ?? []
if (!allowed.includes(newStatus)) throw new Error("Invalid transition")
```

---

### 3.2 SequenceStep Model
**Purpose:** Individual step in a retention sequence (one channel, one delay).

```
Model: SequenceStep
├─ id: String (cuid)
├─ sequenceId: String @relation(RetentionSequence, onDelete: Cascade)
├─ stepOrder: Int (1, 2, 3, ...)
├─ channel: String (EMAIL, SMS, CALL)
├─ scriptId: String? @relation(Script, onDelete: SetNull)
├─ delayValue: Int (number of units)
├─ delayUnit: String (HOURS, DAYS, WEEKS)
├─ conditions: String (JSON—execution conditions)
├─ isActive: Boolean
├─ createdAt, updatedAt
```

**Delay Calculation (used by scheduler):**
```ts
function delayToMs(value: number, unit: string): number {
  switch (unit) {
    case "HOURS": return value * 60 * 60 * 1000
    case "DAYS": return value * 24 * 60 * 60 * 1000
    case "WEEKS": return value * 7 * 24 * 60 * 60 * 1000
  }
}
```

**Indexes:**
- `@@index([sequenceId])`
- `@@index([stepOrder])`

**Relations:**
- `sequence: RetentionSequence` — Parent sequence
- `script: Script?` — Message template
- `executions: SequenceStepExecution[]` — All execution records

**Key Queries:**
```ts
// Get ordered steps for a sequence
prisma.sequenceStep.findMany({
  where: { sequenceId, isActive: true },
  orderBy: { stepOrder: "asc" }
})

// Count active steps (validation before activate)
prisma.sequenceStep.count({
  where: { sequenceId }
})

// Transaction: replace all steps
await prisma.$transaction(async (tx) => {
  await tx.sequenceStep.deleteMany({ where: { sequenceId } })
  return tx.sequenceStep.createMany({
    data: newSteps.map((step, idx) => ({ ...step, stepOrder: idx + 1 }))
  })
})
```

---

### 3.3 SequenceEnrollment Model
**Purpose:** Tracks a lead's enrollment in a sequence (with progress).

```
Model: SequenceEnrollment
├─ id: String (cuid)
├─ sequenceId: String @relation(RetentionSequence, onDelete: Cascade)
├─ leadId: String @relation(Lead, onDelete: Cascade)
├─ status: String (ACTIVE, PAUSED, COMPLETED, CANCELLED, CONVERTED)
├─ currentStep: Int (0-indexed step number)
├─ enrolledAt: DateTime
├─ completedAt: DateTime?
├─ lastStepAt: DateTime?
└─ meta: String (JSON—retry tracking, custom state)
```

**Status Meanings:**
- `ACTIVE` — Currently processing steps
- `PAUSED` — Paused by user; can resume
- `COMPLETED` — All steps executed
- `CANCELLED` — Manually unenrolled
- `CONVERTED` — Lead converted (no more steps)

**Unique Constraint:**
- `@@unique([sequenceId, leadId])` — One enrollment per lead per sequence

**Indexes:**
- `@@index([sequenceId])`
- `@@index([status])`
- `@@index([leadId])`

**Meta Fields (JSON):**
```json
{
  "retry_<executionId>": true
}
```

**Relations:**
- `sequence: RetentionSequence`
- `lead: Lead`
- `executions: SequenceStepExecution[]` — All step executions

**Key Queries:**
```ts
// Check if already enrolled
prisma.sequenceEnrollment.findUnique({
  where: { sequenceId_leadId: { sequenceId, leadId } }
})

// Enroll lead (transaction—check + create + schedule first step)
await prisma.$transaction(async (tx) => {
  const existing = await tx.sequenceEnrollment.findUnique({
    where: { sequenceId_leadId: { sequenceId, leadId } }
  })
  if (existing && existing.status === "ACTIVE") throw new Error("Already enrolled")
  if (existing) await tx.sequenceEnrollment.delete({ where: { id: existing.id } })

  const enrollment = await tx.sequenceEnrollment.create({
    data: { sequenceId, leadId, status: "ACTIVE", currentStep: 0 }
  })

  // Schedule first step execution
  await tx.sequenceStepExecution.create({
    data: {
      enrollmentId: enrollment.id,
      stepId: firstStep.id,
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() + delayMs)
    }
  })
})

// Mark all enrollments as converted
prisma.sequenceEnrollment.updateMany({
  where: { leadId, status: "ACTIVE" },
  data: { status: "CONVERTED", completedAt: new Date() }
})

// Auto-enroll matching leads
const matchingLeads = await prisma.lead.findMany({
  where: { createdAt: {gte: lookbackDate}, source, status },
  select: { id: true }
})
const existingEnrollments = await prisma.sequenceEnrollment.findMany({
  where: { sequenceId, leadId: { in: leadIds } },
  select: { leadId: true, status: true }
})
const activeEnrolledIds = new Set(
  existingEnrollments
    .filter(e => e.status === "ACTIVE")
    .map(e => e.leadId)
)
// Then enroll non-active leads
```

---

### 3.4 SequenceStepExecution Model
**Purpose:** Records actual execution of each step for each enrollment.

```
Model: SequenceStepExecution
├─ id: String (cuid)
├─ enrollmentId: String @relation(SequenceEnrollment, onDelete: Cascade)
├─ stepId: String @relation(SequenceStep, onDelete: Cascade)
├─ contactAttemptId: String? @relation(ContactAttempt, onDelete: SetNull)
├─ status: String (PENDING, SCHEDULED, SENT, DELIVERED, FAILED, SKIPPED)
├─ scheduledAt: DateTime?
├─ executedAt: DateTime?
└─ result: String (JSON—provider response or error)
```

**Status Flow:**
```
SCHEDULED → SENT → DELIVERED
SCHEDULED → FAILED → SCHEDULED (retry after 1 hour)
SCHEDULED → SKIPPED (if step conditions not met or lead missing contact info)
PENDING (legacy, rarely used)
```

**Retry Logic:**
- First failure: Reschedule 1 hour later
- Second failure: Skip step and move to next
- Retry state tracked in parent SequenceEnrollment.meta

**Indexes:**
- `@@index([enrollmentId])`
- `@@index([stepId])`
- `@@index([status])`
- `@@index([scheduledAt])` — CRITICAL for CRON scheduler

**Result JSON:**
```json
{
  "attemptId": "contactAttempt_xyz",
  "error": "Email address invalid",
  "retrying": true
}
```

**Key Queries:**
```ts
// CRON: Find all due executions (scheduler)
prisma.sequenceStepExecution.findMany({
  where: {
    status: "SCHEDULED",
    scheduledAt: { lte: now },
    enrollment: { status: "ACTIVE" }
  },
  include: {
    enrollment: {
      include: { sequence: { select: { status: true } } }
    }
  },
  take: 100,
  orderBy: { scheduledAt: "asc" }
})

// Mark as sent with linked attempt
prisma.sequenceStepExecution.update({
  where: { id },
  data: {
    status: "SENT",
    executedAt: new Date(),
    contactAttemptId: routeResult.attemptId,
    result: JSON.stringify({ attemptId })
  }
})

// Schedule retry on failure
prisma.sequenceStepExecution.update({
  where: { id },
  data: {
    status: "SCHEDULED",
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    result: JSON.stringify({ error, retrying: true })
  }
})

// Update from contact attempt callback
prisma.sequenceStepExecution.findFirst({
  where: { contactAttemptId }
})
```

---

## 4. INTEGRATION MODELS

### 4.1 IntegrationConfig Model
**Purpose:** Stores credentials and config for third-party integrations.

```
Model: IntegrationConfig
├─ id: String (cuid)
├─ provider: String @unique (instantly, keitaro, twilio, vapi, etc.)
├─ type: String (email, sms, call, tracking)
├─ config: String (JSON—provider-specific secrets)
├─ isActive: Boolean
├─ createdAt, updatedAt
```

**Config Examples:**
```json
{
  "provider": "instantly",
  "config": { "apiKey": "....", "accountEmail": "..." }
}

{
  "provider": "twilio",
  "config": { "accountSid": "...", "authToken": "..." }
}

{
  "provider": "vapi",
  "config": { "apiKey": "..." }
}
```

**Key Queries:**
```ts
// Get provider config
const config = await prisma.integrationConfig.findUnique({
  where: { provider: "instantly" }
})
if (!config || !config.isActive) throw new Error("Not configured")
const { apiKey } = JSON.parse(config.config)
```

---

## 5. AUTH CENTER INTEGRATION

### SSO Flow (Cookie-based)
1. User logs in at **Auth Center** (`ag4.q37fh758g.click`)
2. Auth Center sets `ac_access` cookie (JWT token)
3. **Retention Center** middleware (`lib/auth.ts`) reads `ac_access`
4. Shared cookie domain allows **cross-app SSO**

### API Integration
All API routes use `verifyApiAuth()` middleware:
- Checks `Authorization: Bearer <ac_access>` header
- Returns 401 if invalid/expired
- Client-side: uses `getCookie("ac_access")` for headers

**Auth Files:**
- `/src/lib/auth.ts` — Cookie/token utilities
- `/src/lib/api-auth.ts` — Server-side API verification
- `/src/middleware.ts` — Redirect to login if no token
- `/src/app/auth/callback+token+logout` — Token endpoints

---

## 6. INSTANTLY.AI CRM INTEGRATION

### Sync Pattern
1. **Campaign Creation** → `campaign.meta.instantlySync = true`
2. **Sync Campaign** → POST `/api/v2/campaigns` → Get `instantlyCampaignId`
3. **Push Leads** → POST `/api/v2/leads` with `campaign_id` + lead array
4. **Pull Stats** → GET `/api/v2/campaigns/{id}/analytics`

### Data Mapping
```ts
// Local → Instantly
{
  email: lead.email,
  first_name: lead.firstName,
  last_name: lead.lastName,
  phone: lead.phone
}
```

**Service Methods (campaign.service.ts):**
- `syncToInstantly(campaignId)` — Create campaign in Instantly
- `pushLeadsToInstantly(campaignId)` — Sync leads with email
- `pullInstantlyStats(campaignId)` — Fetch campaign analytics

---

## 7. KEY QUERY PATTERNS

### 7.1 Pagination + Filtering
```ts
const page = filters.page ?? 1
const pageSize = filters.pageSize ?? 20
const [data, total] = await Promise.all([
  prisma.model.findMany({
    where: buildWhereClause(filters),
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * pageSize,
    take: pageSize
  }),
  prisma.model.count({ where: buildWhereClause(filters) })
])
return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
```

### 7.2 Aggregation + Stats
```ts
const stats = await Promise.all([
  prisma.lead.count(),
  prisma.lead.groupBy({
    by: ["status"],
    _count: true
  }),
  prisma.contactAttempt.groupBy({
    by: ["channel"],
    _avg: { duration: true, cost: true }
  })
])
```

### 7.3 Nested Includes (with _count)
```ts
prisma.campaign.findUnique({
  where: { id },
  include: {
    campaignLeads: { include: { lead: true }, orderBy: { assignedAt: "desc" } },
    scripts: true,
    _count: { select: { campaignLeads: true } }
  }
})
```

### 7.4 Transactions (atomic operations)
```ts
await prisma.$transaction(async (tx) => {
  await tx.sequenceStep.deleteMany({ where: { sequenceId: id } })
  return tx.sequenceStep.createMany({
    data: newSteps.map((step, idx) => ({ ...step, stepOrder: idx + 1 }))
  })
})
```

### 7.5 Deduplication (findFirst with OR)
```ts
const existing = await prisma.lead.findFirst({
  where: {
    OR: [
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : [])
    ]
  }
})
```

### 7.6 Caching + TTL
```ts
const CACHE_TTL = 60_000 // 1 minute
const cached = getCached<T>(cacheKey)
if (cached) return cached

const result = await fetchFromDb()
setCache(cacheKey, result)
return result
```

---

## 8. COMMON WORKFLOWS

### Lead Lifecycle
```
1. CREATE lead (dedup by email/phone)
   ↓
2. ASSIGN to campaign (CampaignLead)
   ↓
3. ENROLL in retention sequence (SequenceEnrollment)
   ↓
4. EXECUTE steps (ContactAttempt + SequenceStepExecution)
   ↓
5. CONVERT (Conversion event) or COMPLETE
```

### Sequence Execution (CRON)
```
1. SequenceProcessorService.runAll() — CRON endpoint
   ├─ processAllDueSteps()
   │  ├─ Find due SequenceStepExecution (status=SCHEDULED, scheduledAt≤now)
   │  └─ ProcessNextStep for each
   └─ autoEnrollNewLeads()
      ├─ Find active sequences with auto-triggers
      └─ Enroll matching leads

2. ProcessNextStep(enrollmentId)
   ├─ Find pending execution
   ├─ Validate lead has channel (email, phone)
   ├─ Route to ChannelRouter → Create ContactAttempt
   ├─ On success: Mark SENT, link to ContactAttempt, schedule next step
   └─ On failure: Retry once (1 hour later), then skip

3. ScheduleNextStep (private helper)
   ├─ Find next step in sequence
   ├─ Calculate delay (delayValue + delayUnit)
   ├─ Create SequenceStepExecution with scheduledAt
   └─ Or mark enrollment COMPLETED if no more steps
```

### Conversion Flow
```
1. Keitaro postback → POST /api/webhooks/keitaro
   ├─ Find/create Conversion
   ├─ Link to Lead (leadId) + Campaign (campaignId)
   └─ Trigger SequenceProcessorService.handleConversion(leadId)

2. handleConversion(leadId)
   ├─ Find all ACTIVE enrollments for lead
   ├─ Mark as CONVERTED
   └─ Cancel pending SequenceStepExecutions
```

---

## 9. PERFORMANCE CONSIDERATIONS

### Indexes That Matter
| Model | Index | Why |
|-------|-------|-----|
| Lead | email, phone | Deduplication, bulk lookups |
| ContactAttempt | scheduledAt | CRON scheduler (1000s of rows) |
| SequenceStepExecution | status + scheduledAt | CRON: "find due executions" |
| SequenceEnrollment | sequenceId + status | Auto-enroll, bulk updates |
| Conversion | leadId, campaignId, subId | Link tracking, stats |

### N+1 Query Prevention
- Use `include: { _count: { select: {...} } }` for counts
- Batch fetch with `in: [...]` before loops
- Use Promise.all for parallel queries

### Caching
- Report Service uses 1-minute TTL for analytics
- In-memory Map with Date.now() expiry check
- Cache keys: `overview:dateFrom:dateTo`

---

## 10. AB TESTING & LEARNING

### ABTest Model
```
Model: ABTest
├─ campaignId: String @relation(Campaign, onDelete: Cascade)
├─ channel: String
├─ variantA, variantB: String (script content or config)
├─ status: String (RUNNING, COMPLETED)
├─ winnerId: String?
├─ statsA, statsB: String (JSON aggregates)
└─ startedAt, endedAt
```

*(Limited implementation—mostly schema; actual A/B logic in learning.service.ts)*

---

## Summary of Relationship Graph

```
┌─────────────────────────────────────────────────────────┐
│                     LEAD (center)                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
├─→ campaignLeads ──→ CAMPAIGN ──→ scripts (Script)      │
│                                 └─→ abTests (ABTest)    │
│                                 └─→ contactAttempts     │
│                                 └─→ conversions          │
│                                                         │
├─→ contactAttempts ──→ CONTACTATTEMPT ──→ script        │
│                                       └─→ sequenceStepExecution
│                                                         │
├─→ sequenceEnrollments ──→ SEQUENCEENROLLMENT           │
│                              ├─→ retentionSequence      │
│                              │    ├─→ steps (SequenceStep)
│                              │    │    ├─→ script       │
│                              │    │    └─→ executions   │
│                              │    └─→ enrollments       │
│                              └─→ executions ──→ contactAttempt
│                                                         │
└─→ conversions ──→ CONVERSION ──→ campaign               │
                                └─→ contactAttempt        │
└─────────────────────────────────────────────────────────┘

INTEGRATION MODELS:
  - IntegrationConfig (provider credentials)
  - ConversionRule (statistical tracking)
```

---

**Document Version:** 2026-02-21
**Last Reviewed:** Task #6 (retention-relations)
**Maintained By:** Team Lead (db-architecture-docs)
