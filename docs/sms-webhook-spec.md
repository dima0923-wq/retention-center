# SMS Delivery Webhook & Delivery Log — Feature Spec

## Overview

Track every SMS delivery status callback as an immutable event log (`SmsDeliveryEvent`), separate from the mutable `ContactAttempt` status. This gives full audit history of provider callbacks, enables delivery analytics, and supports debugging failed deliveries.

---

## 1. Prisma Model: SmsDeliveryEvent

```prisma
model SmsDeliveryEvent {
  id               String   @id @default(cuid())
  contactAttemptId String
  providerRef      String                        // provider message ID
  provider         String                        // "sms-retail" | "23telecom"
  status           String                        // normalized: SENT | DELIVERED | FAILED | UNDELIVERED | PENDING | UNKNOWN
  rawStatus        String                        // original status string from provider (e.g. "DELIVRD", "UNDELIV")
  rawPayload       String   @default("{}")       // full JSON of the webhook payload
  receivedAt       DateTime @default(now())      // when we received the callback
  ip               String?                       // sender IP for audit trail

  contactAttempt ContactAttempt @relation(fields: [contactAttemptId], references: [id], onDelete: Cascade)

  @@index([contactAttemptId])
  @@index([providerRef])
  @@index([receivedAt])
  @@index([provider])
  @@index([status])
}
```

**ContactAttempt changes** — add reverse relation:
```prisma
model ContactAttempt {
  // ... existing fields ...
  deliveryEvents SmsDeliveryEvent[]
}
```

### Status Normalization Map

| Provider Raw Status | Normalized Status |
|---|---|
| `delivered`, `DELIVRD` | `DELIVERED` |
| `sent` | `SENT` |
| `failed`, `UNDELIV`, `undelivered` | `FAILED` |
| `pending`, `queued` | `PENDING` |
| _(anything else)_ | `UNKNOWN` |

---

## 2. Enhanced Webhook Endpoint

**Route**: `POST /api/webhooks/sms` (existing — enhance in place)

### Flow

1. Parse raw request body as JSON
2. Extract sender IP from `x-forwarded-for` or `x-real-ip` header (falls back to `request.ip`)
3. Determine provider from payload shape (see Provider Detection below)
4. Optional: verify HMAC/token if configured in `IntegrationConfig.config.webhookSecret`
5. Extract `providerRef` and `rawStatus` using provider-specific parsing
6. Normalize `rawStatus` to canonical status using the map above
7. Find matching `ContactAttempt` by `providerRef`
8. If found: create `SmsDeliveryEvent` record, then update `ContactAttempt.status`
9. If not found: still create `SmsDeliveryEvent` with `contactAttemptId` left empty (log orphan for debugging) — **SKIP**: orphan events without a ContactAttempt should just be logged to console and discarded, since the FK is required
10. **Always return `200 { success: true }`** — never fail webhook responses

### Provider Detection

**sms-retail** payload shape:
```json
{ "id": 12345, "status": "delivered", ... }
```
- Has numeric `id` field
- Status values: `delivered`, `sent`, `failed`, `undelivered`

**23telecom** payload shape:
```json
{ "messageId": "abc-123", "status": "DELIVRD", ... }
```
- Has string `messageId` field
- Status values: `DELIVRD`, `UNDELIV`, `SENT`, `PENDING`

**Detection logic**:
```
if payload.messageId exists -> provider = "23telecom"
else if payload.id exists   -> provider = "sms-retail"
else                         -> unknown, log and return 200
```

### HMAC/Token Verification (Optional)

If `IntegrationConfig.config` contains `webhookSecret` for the detected provider:
- **sms-retail**: Check `X-Signature` header against HMAC-SHA256 of raw body with secret
- **23telecom**: Check `token` query parameter matches the configured secret
- If verification fails: log warning, still return 200 (don't reveal to sender), but do NOT process the event

Configuration stored in existing `IntegrationConfig` model:
```json
{
  "apiKey": "...",
  "webhookSecret": "optional-hmac-secret"
}
```

---

## 3. New API Endpoints

### GET /api/sms-delivery-log

Paginated list of `SmsDeliveryEvent` records with filters.

**Auth**: `verifyApiAuth` + `requirePermission(user, 'retention:analytics:view')`

**Query Parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number (1-based) |
| `limit` | number | 50 | Items per page (max 100) |
| `leadId` | string | — | Filter by lead (join through ContactAttempt) |
| `status` | string | — | Filter by normalized status |
| `provider` | string | — | Filter by provider name |
| `from` | ISO date | — | receivedAt >= from |
| `to` | ISO date | — | receivedAt <= to |
| `providerRef` | string | — | Exact match on providerRef |

**Response**:
```json
{
  "data": [
    {
      "id": "clxyz...",
      "contactAttemptId": "clxyz...",
      "providerRef": "12345",
      "provider": "sms-retail",
      "status": "DELIVERED",
      "rawStatus": "delivered",
      "receivedAt": "2026-02-25T10:30:00.000Z",
      "ip": "1.2.3.4",
      "lead": {
        "id": "clxyz...",
        "firstName": "John",
        "lastName": "Doe",
        "phone": "+1234567890"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 142,
    "totalPages": 3
  }
}
```

**Implementation notes**:
- Join `ContactAttempt` -> `Lead` for lead info
- Order by `receivedAt DESC`
- Use Prisma `skip` / `take` for pagination

### GET /api/sms-delivery-log/[attemptId]

All delivery events for a specific ContactAttempt, ordered chronologically.

**Auth**: `verifyApiAuth` + `requirePermission(user, 'retention:analytics:view')`

**Response**:
```json
{
  "attempt": {
    "id": "clxyz...",
    "leadId": "clxyz...",
    "channel": "SMS",
    "status": "SUCCESS",
    "provider": "sms-retail",
    "providerRef": "12345",
    "startedAt": "2026-02-25T10:00:00.000Z",
    "completedAt": "2026-02-25T10:30:00.000Z",
    "lead": {
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1234567890"
    }
  },
  "events": [
    {
      "id": "clxyz...",
      "status": "SENT",
      "rawStatus": "sent",
      "rawPayload": "{...}",
      "receivedAt": "2026-02-25T10:00:05.000Z",
      "ip": "1.2.3.4"
    },
    {
      "id": "clxyz...",
      "status": "DELIVERED",
      "rawStatus": "delivered",
      "rawPayload": "{...}",
      "receivedAt": "2026-02-25T10:30:00.000Z",
      "ip": "1.2.3.4"
    }
  ]
}
```

---

## 4. Frontend: SMS Delivery Log Page

**Route**: `/sms-delivery-log` (new page)

### Layout

Top section — summary cards:
- Total Events (count)
- Delivered (count + %)
- Failed (count + %)
- Avg Delivery Time (from SENT to DELIVERED events on same attempt)

### Filters Bar
- Provider dropdown (All / sms-retail / 23telecom)
- Status dropdown (All / DELIVERED / FAILED / SENT / PENDING / UNKNOWN)
- Date range picker (from / to)
- Search by phone or lead name (searches through lead relation)

### Data Table
Columns:
| Column | Source |
|---|---|
| Time | `receivedAt` formatted |
| Lead | `lead.firstName + lastName` (link to lead detail) |
| Phone | `lead.phone` |
| Provider | `provider` |
| Status | normalized `status` with color badge |
| Raw Status | `rawStatus` (muted text) |
| Provider Ref | `providerRef` |

- Click row to expand: shows `rawPayload` JSON, IP address, all events for that attempt
- Pagination at bottom

### Navigation
- Add link in sidebar under existing "SMS Stats" entry, or as a sub-tab on the SMS Stats page

---

## 5. Files to Create/Modify

| Action | File | Owner |
|---|---|---|
| Modify | `prisma/schema.prisma` — add `SmsDeliveryEvent` model + relation | db-engineer |
| Modify | `src/app/api/webhooks/sms/route.ts` — enhanced webhook handler | backend-dev |
| Modify | `src/services/channel/sms.service.ts` — add status normalization helper | backend-dev |
| Create | `src/app/api/sms-delivery-log/route.ts` — paginated list endpoint | backend-dev |
| Create | `src/app/api/sms-delivery-log/[attemptId]/route.ts` — attempt detail endpoint | backend-dev |
| Create | `src/app/(dashboard)/sms-delivery-log/page.tsx` — frontend page | frontend-dev |
| Create | `src/app/(dashboard)/sms-delivery-log/DeliveryLogTable.tsx` — table component | frontend-dev |

---

## 6. Migration Notes

- Migration name: `add_sms_delivery_event`
- SQLite compatible (no array/JSON types — use String for rawPayload)
- No data migration needed — new table starts empty
- Existing ContactAttempt data unchanged
