# Retention Center - Business Analysis

## 1. Meta Lead Lifecycle

### Overview

The Retention Center captures leads from Meta (Facebook/Instagram) advertising campaigns and nurtures them through multi-channel outreach (Email, SMS, Voice Calls) until conversion. The full lifecycle:

```
Meta Lead Ad -> Keitaro Tracker -> Retention Center Webhook -> Lead Created -> Auto-Routed to Campaigns -> Multi-Channel Outreach -> Conversion Postback
```

### Step-by-Step Flow

**1. Lead Capture (Meta Webhook)**
- Meta sends a `leadgen` webhook to `/api/webhooks/meta`
- The handler extracts: `firstName`, `lastName`, `email`, `phone`, `sub_id`, `click_id`
- Fields can arrive as `field_data[]` array or flat object — handler supports both formats
- Lead is created via `LeadService.create()` with `source: "META"` and deduplication by email/phone

**2. Auto-Routing (LeadRouterService)**
- New leads (non-duplicated) are immediately passed to `LeadRouterService.routeNewLead()`
- The router finds all ACTIVE campaigns whose `autoAssign` config matches the lead's source
- AutoAssign rules support: source filtering (`META`, `API`, `MANUAL`, `BULK`), maxLeads cap
- For each matching campaign, a `CampaignLead` join record is created

**3. Multi-Channel Queuing**
- After campaign assignment, `LeadRouterService.queueAllChannels()` fires ALL viable channels in parallel using `Promise.allSettled()`
- Channel viability depends on lead contact info: EMAIL needs `lead.email`, SMS/CALL need `lead.phone`
- Channels are sorted by priority: EMAIL (0) > SMS (1) > CALL (2)

**4. Channel Routing (ChannelRouterService)**
- Each channel goes through `ChannelRouterService.routeContact()`
- Pre-checks: per-lead contact limit (default 5), schedule hours, rate limits
- If outside schedule or rate-limited, contact is deferred via `SchedulerService.scheduleContact()` (creates a SCHEDULED ContactAttempt with future `startedAt`)
- A/B test check: if an active test exists for campaign+channel, a random variant (A/B) is selected
- Script selection: campaign-specific script > default script for channel type
- A `ContactAttempt` record is created, then the actual send is dispatched

**5. Channel Execution**
| Channel | Provider | Service | How it Works |
|---------|----------|---------|--------------|
| EMAIL | Instantly.ai | `InstantlyService.sendEmail()` | Adds lead to Instantly campaign with custom variables (subject, body from script template) |
| SMS | SMS-Retail or 23Telecom | `SmsService.sendSms()` | Sends SMS via configured provider API; supports variable replacement `{{firstName}}`, etc. |
| CALL | VAPI | `VapiService.createCall()` | Initiates AI voice call; config priority: script > campaign > integration defaults |

**6. Status Updates (Webhooks)**
- **Instantly**: Events like `email_sent`, `email_opened`, `reply_received`, `email_bounced` update ContactAttempt status
- **SMS**: Delivery reports (`delivered`/`DELIVRD` -> SUCCESS, `failed`/`UNDELIV` -> FAILED)
- **VAPI**: Call status callbacks (`ended`/`completed` -> SUCCESS with transcript + keywords, `failed`/`no-answer` -> FAILED)

**7. Conversion Tracking (Keitaro Postback)**
- Keitaro sends GET/POST to `/api/webhooks/keitaro` with `sub_id`, `status`, `payout`, `click_id`
- `sub_id` is matched first to `ContactAttempt.id`, then to `Lead.externalId`
- A `Conversion` record is created linking lead, campaign, channel, revenue
- If the ContactAttempt was part of an A/B test (noted in `attempt.notes`), the outcome is recorded and the test may auto-end at 95% confidence with 50+ samples
- Lead status is updated: `sale` -> CONVERTED, `reject` -> REJECTED

### Lead Statuses

| Status | Meaning |
|--------|---------|
| NEW | Just created, not yet contacted |
| IN_PROGRESS | At least one contact attempt is active |
| CONTACTED | Contacted but no conversion yet |
| CONVERTED | Successful conversion (sale via Keitaro) |
| REJECTED | Rejected by advertiser |
| DO_NOT_CONTACT | Permanent opt-out (cannot be changed) |

---

## 2. Retention Sequences Design

### Problem Statement

Currently, the system fires ALL channels simultaneously when a lead enters a campaign. There is no concept of **timed follow-up** — a lead either converts on the first blast or gets no further attention. This is a critical gap because:

- Most leads need 3-7 touchpoints before converting
- Different channels work better at different stages (email first, then SMS, then call)
- Timing matters: 12h follow-up vs. 5-day follow-up have very different conversion rates
- The current `delayBetweenChannels` config is a blunt instrument — it's a flat delay, not a sequence

### Proposed Retention Sequence Model

A **Retention Sequence** is an ordered series of **Steps**, each defining:
- **Channel**: EMAIL, SMS, or CALL
- **Delay**: Time to wait after previous step (or after enrollment) before executing
- **Script**: The specific content/template to use
- **Conditions**: Optional rules (e.g., "only if lead hasn't opened email", "skip if already converted")

```
Sequence: "New Meta Lead Nurture"
  Step 1: EMAIL immediately (Welcome email)
  Step 2: SMS after 12 hours ("Hey {{firstName}}, saw you were interested...")
  Step 3: EMAIL after 24 hours (Offer details)
  Step 4: CALL after 2 days (Personal follow-up)
  Step 5: SMS after 5 days ("Last chance: exclusive deal...")
  Step 6: EMAIL after 7 days (Final reminder)
```

### Key Design Decisions

**Enrollment Triggers:**
- Auto-enroll on lead creation (via webhook handler, replacing current `queueAllChannels`)
- Manual enrollment from lead detail page
- Bulk enrollment from campaign lead list
- Re-enrollment for leads that drop off without converting

**Step Execution Logic:**
1. A CRON job (or API-triggered processor) runs every 1-5 minutes
2. Finds all `SequenceEnrollment` records where the next step is due
3. For each due step:
   - Check if lead status allows contact (not CONVERTED, not DO_NOT_CONTACT)
   - Check if campaign is still ACTIVE (not PAUSED)
   - Check schedule hours via `SchedulerService.isWithinSchedule()`
   - If conditions pass: execute via `ChannelRouterService.routeContact()`
   - If outside hours: defer to next available slot (don't skip the step)
   - On success: advance `currentStep`, calculate next step's `executeAt`
   - On failure: retry logic (configurable max retries per step)

**Exit Conditions:**
- Lead converts (Keitaro postback with `status=sale`)
- Lead requests opt-out (status = DO_NOT_CONTACT)
- All steps completed
- Campaign paused or ended
- Manual removal by operator

### Interaction with Existing Architecture

The sequence engine should **replace** (not duplicate) the current behavior in `LeadRouterService.queueAllChannels()`:

- **Before**: Lead enters campaign -> ALL channels fire simultaneously
- **After**: Lead enters campaign -> Enrolled in campaign's retention sequence -> Steps execute on schedule

The existing `ChannelRouterService.routeContact()` remains unchanged — it's the execution layer. The sequence engine is the **orchestration layer** that decides **when** and **which channel** to route through.

---

## 3. Late Conversion Logic

### Current Gap

The current system has no mechanism to track "where a lead is" in a follow-up journey. Once the initial multi-channel blast fires, leads that don't convert are effectively abandoned. The only re-engagement path is manual: an operator must identify cold leads and create a new campaign.

### Proposed Late Conversion Handling

**Sequence State Tracking:**
Each enrollment tracks:
- `currentStep`: Which step the lead is on (0-indexed)
- `status`: ACTIVE / PAUSED / COMPLETED / CONVERTED / EXITED
- `nextExecuteAt`: When the next step should fire
- `completedSteps`: JSON array of step execution results (timestamps, statuses, attemptIds)

**Progressive Channel Escalation:**
The default pattern should escalate from low-touch to high-touch:
1. **Immediate**: Welcome email (low cost, broad reach)
2. **12h**: SMS reminder (medium cost, high open rate)
3. **24h**: Second email with offer details
4. **2 days**: AI voice call (high cost, high conversion)
5. **5 days**: SMS with urgency/scarcity
6. **7 days**: Final email

**Smart Re-engagement:**
- If a lead opens an email but doesn't convert, insert an extra SMS step
- If a lead answers a call but says "call back later", schedule a callback (already supported by VAPI keyword extraction)
- If a lead is in a sequence and a Keitaro postback arrives with `status=sale`, immediately exit the sequence and mark as CONVERTED

**Cooldown Between Sequences:**
- A lead should not be re-enrolled in the same sequence within a configurable cooldown period (e.g., 30 days)
- Different sequences can overlap if they serve different campaigns

---

## 4. Learning Page Analysis

### Current Implementation

The Learning Page (`/learning`) displays:

1. **Overview Cards**: Total Conversions, Revenue, Avg Conv Rate, Best Channel
2. **Word Performance**: Tokenizes script content, correlates words with conversion outcomes, shows conversion rate + lift + confidence per word, filtered by channel tab (SMS/Call/Email)
3. **Auto-Generated Insights**: Text-based insights from `LearningService.generateInsights()` covering word performance, time-of-day patterns, channel comparison, funnel bottlenecks
4. **Conversion Funnel**: Leads -> Contacted -> Responded -> Converted -> Revenue (with drop-off rates)
5. **Conversion Heatmap**: Day-of-week x hour grid showing conversion rates
6. **A/B Tests**: Active and completed tests with statistical significance (z-test, 95% confidence)
7. **Script Suggestions**: Best/worst words to include/avoid, optimal send time, template recommendations

### What's Working Well

- **Statistical rigor**: The z-test implementation for both word performance and A/B tests is sound, with proper minimum sample sizes (10 for words, 50 for A/B auto-end)
- **Multi-channel support**: Word performance and insights are properly segmented by channel
- **Funnel visualization**: Drop-off rates between stages give clear visibility into bottlenecks
- **A/B test automation**: Tests auto-end when 95% confidence is reached, preventing premature conclusions

### What Needs Improvement

**1. No Sequence-Level Analytics (Critical Gap)**
- Currently, all analytics are at the campaign/channel level
- With retention sequences, we need per-step analytics: Which step has the highest drop-off? Which step drives the most conversions? What's the optimal delay between steps?
- Example metric: "Step 3 (24h email) has 45% drop-off but Step 4 (2-day call) converts 3x better than average"

**2. Time-to-Conversion Not Tracked**
- The system tracks *if* a lead converts, but not *how long it took*
- With sequences, this becomes critical: "Leads that convert from Step 2 (12h SMS) have 2x higher LTV than leads that convert from Step 5 (5-day SMS)"
- Need: `time_to_conversion` calculated from enrollment to conversion

**3. Funnel Missing Intermediate States**
- Current funnel: Leads -> Contacted -> Responded -> Converted -> Revenue
- With sequences: Leads -> Enrolled -> Step 1 Executed -> Step 2 Executed -> ... -> Converted
- The funnel should show drop-off at each sequence step, not just broad categories

**4. Heatmap Should Inform Scheduling**
- The heatmap shows when conversions happen, but this data isn't fed back into the scheduler
- The `ConversionRule` table is populated by `updateConversionRules()` but nothing consumes these rules for scheduling decisions
- Recommended: Scheduler should prefer sending at times when conversion rates are highest for that channel

**5. Word Performance Limitations**
- Only analyzes single words (unigrams), not phrases or sentence structures
- Minimum sample of 10 is low for statistical significance in NLP
- No consideration of word position (opening vs. closing), word combinations, or script length

**6. No Cross-Campaign Learning**
- Insights are generated per-campaign or globally, but there's no way to compare sequence effectiveness across campaigns
- A "Sequence Leaderboard" similar to the existing batch leaderboard would be valuable

**7. Suggestions Not Actionable**
- Script suggestions show words to include/avoid, but operators still need to manually write scripts
- Consider: Auto-generate draft scripts using top-performing word combinations

### Recommended Enhancements for Learning Page

| Priority | Enhancement | Impact |
|----------|-------------|--------|
| P0 | Sequence step-by-step analytics (drop-off, conversion per step) | Enables sequence optimization |
| P0 | Time-to-conversion tracking | Identifies optimal sequence length |
| P1 | Sequence comparison view (side-by-side performance) | Finds best sequence template |
| P1 | Feed heatmap data into scheduler (optimal send times) | Improves conversion rates |
| P2 | Bigram/trigram word analysis | Better script optimization |
| P2 | Auto-generated script drafts from top words | Reduces manual work |
| P3 | Cross-campaign learning aggregation | Global optimization |

---

## 5. Sequence Performance Metrics

### Key Metrics to Track

**Per-Sequence Metrics:**
| Metric | Definition | Why It Matters |
|--------|------------|---------------|
| Enrollment Rate | Leads enrolled / Total leads | Measures sequence reach |
| Completion Rate | Leads that finished all steps / Enrolled | Shows if sequence is too long |
| Conversion Rate | Converted / Enrolled | Overall effectiveness |
| Revenue Per Enrolled Lead | Total revenue / Enrolled | ROI per sequence |
| Avg Time to Conversion | Mean time from enrollment to conversion | Optimal sequence length |
| Drop-off Rate | % of leads that exit without converting at each step | Identifies weak steps |

**Per-Step Metrics:**
| Metric | Definition | Why It Matters |
|--------|------------|---------------|
| Execution Rate | Executed / Reached this step | Shows delivery reliability |
| Step Conversion Rate | Converted at this step / Executed | Value of this specific step |
| Marginal Conversion Lift | Step N conv rate - Step N-1 cumulative rate | Whether this step adds value |
| Channel Effectiveness | Conv rate per channel at this step | Optimal channel per position |
| Optimal Delay | Correlation between delay duration and conv rate | Fine-tune timing |

**Operational Metrics:**
| Metric | Definition |
|--------|------------|
| Active Enrollments | Currently in-progress sequences |
| Steps Processed / Hour | Throughput of the sequence processor |
| Failed Attempts Rate | % of step executions that failed |
| Scheduled Backlog | Steps waiting to be processed |

### How to Measure Step Drop-Off

For each step in a sequence, calculate:
1. **Entered**: Number of leads that reached this step
2. **Executed**: Number where the channel actually fired
3. **Responded**: For email: opened; for SMS: delivered; for call: answered
4. **Converted**: Leads that converted after this step (before next step)
5. **Dropped**: Leads that exited the sequence at this step

The biggest drop-off point is the optimization target. Common fixes:
- High drop-off after email? -> Try SMS at that step
- High drop-off at step 4+? -> Sequence may be too long
- Drop-off correlates with time of day? -> Adjust scheduling

### Optimal Timing Analysis

The system should track for each delay interval:
- What % of leads that receive Step N at `delay=X` convert, vs. `delay=Y`?
- Statistical test (z-test) to determine if the difference is significant
- Auto-suggest delay adjustments: "Increasing Step 3 delay from 24h to 36h improved conversion by 15% (p < 0.05)"

---

## 6. Integration Points

### How Sequences Interact with Existing Services

```
                                 +-----------------------+
                                 | Webhook Handlers      |
                                 | (Meta, Keitaro, etc.) |
                                 +-----------+-----------+
                                             |
                                   Lead Created / Updated
                                             |
                                             v
                              +-----------------------------+
                              | LeadRouterService           |
                              | findMatchingCampaigns()     |
                              | -> enrollInSequence()  [NEW]|
                              +-------------+---------------+
                                            |
                                  Enrollment Created
                                            |
                                            v
                           +-------------------------------+
                           | SequenceProcessor (CRON)      |
                           | - Finds due steps             |
                           | - Checks schedule/rate limits |
                           | - Advances enrollments        |
                           +---------------+---------------+
                                           |
                                     Due Step Found
                                           |
                                           v
                          +-------------------------------+
                          | ChannelRouterService          |
                          | routeContact(lead, campaign,  |
                          |   channel)                    |
                          +------+--------+--------+------+
                                 |        |        |
                                 v        v        v
                              Email     SMS      CALL
                           (Instantly) (SMS-Retail) (VAPI)
                                 |        |        |
                                 v        v        v
                          +-------------------------------+
                          | Webhook Callbacks             |
                          | -> Update ContactAttempt      |
                          | -> Record A/B Test Outcome    |
                          +-------------------------------+
                                           |
                                     Keitaro Postback
                                           |
                                           v
                          +-------------------------------+
                          | Conversion Handler            |
                          | -> Create Conversion record   |
                          | -> Exit sequence if converted |
                          | -> Update lead status         |
                          +-------------------------------+
```

### Service Dependencies

| Service | Role in Sequences | Changes Needed |
|---------|-------------------|----------------|
| **LeadRouterService** | Enrollment trigger | Replace `queueAllChannels()` with `enrollInSequence()` |
| **SchedulerService** | Schedule validation | No changes — already supports `isWithinSchedule()`, `canContactLead()`, `getNextAvailableSlot()` |
| **ChannelRouterService** | Step execution | No changes — `routeContact()` already handles all channels |
| **CampaignService** | Sequence-campaign link | Add sequence assignment to campaigns |
| **LearningService** | Sequence analytics | Add step-level word analysis, time-to-conversion, sequence comparison |
| **ABTestService** | A/B test per step | Already works — A/B tests are per campaign+channel, so they'll work at the step level naturally |
| **Keitaro Webhook** | Conversion exit | Add sequence exit logic when conversion is recorded |
| **Meta Webhook** | Enrollment trigger | Already calls `LeadRouterService.routeNewLead()` |

### API Endpoints Needed

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/sequences` | List all sequences |
| POST | `/api/sequences` | Create a new sequence |
| GET | `/api/sequences/:id` | Get sequence with steps |
| PUT | `/api/sequences/:id` | Update sequence |
| DELETE | `/api/sequences/:id` | Delete sequence (draft only) |
| POST | `/api/sequences/:id/steps` | Add step to sequence |
| PUT | `/api/sequences/:id/steps/:stepId` | Update step |
| DELETE | `/api/sequences/:id/steps/:stepId` | Remove step |
| POST | `/api/sequences/:id/enroll` | Manually enroll leads |
| GET | `/api/sequences/:id/enrollments` | List enrollments with status |
| GET | `/api/sequences/:id/stats` | Sequence performance metrics |
| POST | `/api/scheduler/process-sequences` | Trigger sequence processor (CRON) |

### Database Schema Requirements

New models needed:
- **RetentionSequence**: id, name, description, status (DRAFT/ACTIVE/ARCHIVED), campaignId (optional)
- **SequenceStep**: id, sequenceId, order, channel, delayValue, delayUnit (minutes/hours/days), scriptId, conditions (JSON), maxRetries
- **SequenceEnrollment**: id, sequenceId, leadId, campaignId, status (ACTIVE/PAUSED/COMPLETED/CONVERTED/EXITED), currentStep, nextExecuteAt, completedSteps (JSON), enrolledAt, completedAt
- **SequenceStepExecution**: id, enrollmentId, stepId, contactAttemptId, status, executedAt, result (JSON)

### CRON Processor Design

The sequence processor should run every 1-5 minutes (configurable) and:

1. Query: `SELECT * FROM SequenceEnrollment WHERE status='ACTIVE' AND nextExecuteAt <= NOW() LIMIT 100`
2. For each enrollment:
   a. Load the sequence and current step
   b. Validate: campaign active, lead contactable, within schedule
   c. Execute step via `ChannelRouterService.routeContact()`
   d. Record execution in `SequenceStepExecution`
   e. If more steps remain: calculate `nextExecuteAt` for next step, increment `currentStep`
   f. If last step: set enrollment status to COMPLETED
3. Handle failures: increment retry counter, schedule retry or skip to next step

The processor should be idempotent — if it runs twice for the same enrollment, it should not double-send.

---

## Summary

The Retention Center has a solid foundation for multi-channel outreach with proper lead routing, channel abstraction, scheduling, and conversion tracking. The critical missing piece is **time-based sequence orchestration** — the ability to define and execute multi-step follow-up sequences with configurable delays.

The proposed retention sequence system integrates cleanly with existing services by adding an orchestration layer on top of the current channel routing infrastructure. The Learning Page should be enhanced to provide step-level analytics that enable data-driven sequence optimization.

**Priority order for implementation:**
1. Prisma schema for sequence models
2. Sequence service (core engine + enrollment logic)
3. Sequence processor (CRON-based step executor)
4. REST API routes
5. Sequence Builder UI
6. Webhook integration (auto-enrollment + conversion exit)
7. Learning Page enhancements (step analytics)
8. Dashboard stats integration
