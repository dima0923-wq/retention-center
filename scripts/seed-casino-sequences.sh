#!/bin/bash
# Seed casino campaign and 5 retention sequences for Stake Social Casino
# Run: bash scripts/seed-casino-sequences.sh

DB_PATH="${1:-/Users/sky/retention-center/dev.db}"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

echo "Seeding casino campaign and sequences into: $DB_PATH"

# ─── Campaign: Stake Social Casino — Acquisition ─────────────────────────────
CAMPAIGN_ID="casino_acq_001"

sqlite3 "$DB_PATH" <<SQL
INSERT OR IGNORE INTO Campaign (id, name, description, status, channels, meta, createdAt, updatedAt)
VALUES (
  '${CAMPAIGN_ID}',
  'Stake Social Casino — Acquisition',
  'Primary acquisition campaign for Stake Social Casino. Covers welcome flows, depositor upsells, comeback sequences, VIP nurturing, and hot streak engagement.',
  'ACTIVE',
  '["EMAIL","SMS","CALL","PUSH"]',
  '{"project":"stake-social-casino","source":"casino"}',
  '${NOW}',
  '${NOW}'
);
SQL
echo "✓ Campaign created: ${CAMPAIGN_ID}"

# ─── Sequence 1: WELCOME (Days 0-7) ─────────────────────────────────────────
SEQ1_ID="seq_casino_welcome"

sqlite3 "$DB_PATH" <<SQL
INSERT OR IGNORE INTO RetentionSequence (id, name, description, status, channels, triggerType, triggerConfig, createdAt, updatedAt)
VALUES (
  '${SEQ1_ID}',
  'Casino Welcome (Days 0-7)',
  'Welcome sequence for new casino registrations. Email Day 0 (welcome + bonus), SMS Day 1 (first deposit offer), Email Day 3 (urgency), SMS Day 7 (last chance).',
  'ACTIVE',
  '["EMAIL","SMS"]',
  'new_lead',
  '{"sources":["CASINO","STAKE","casino_webhook"],"project":"stake-social-casino"}',
  '${NOW}',
  '${NOW}'
);

-- Step 1: Email immediately (Day 0) - Welcome + bonus
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_welcome_1',
  '${SEQ1_ID}',
  1,
  'EMAIL',
  0,
  'HOURS',
  '{"template":"casino_welcome","emailTemplateId":"tpl_casino_welcome","description":"Welcome email with signup bonus code"}',
  1,
  '${NOW}',
  '${NOW}'
);

-- Step 2: SMS Day 1 - First deposit offer
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_welcome_2',
  '${SEQ1_ID}',
  2,
  'SMS',
  24,
  'HOURS',
  '{"template":"casino_first_deposit","description":"SMS with first deposit bonus offer"}',
  1,
  '${NOW}',
  '${NOW}'
);

-- Step 3: Email Day 3 - Urgency
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_welcome_3',
  '${SEQ1_ID}',
  3,
  'EMAIL',
  3,
  'DAYS',
  '{"template":"casino_urgency","emailTemplateId":"tpl_casino_urgency","description":"Urgency email - bonus expiring soon","skipIfConverted":true}',
  1,
  '${NOW}',
  '${NOW}'
);

-- Step 4: SMS Day 7 - Last chance
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_welcome_4',
  '${SEQ1_ID}',
  4,
  'SMS',
  7,
  'DAYS',
  '{"template":"casino_last_chance","description":"Last chance SMS - final bonus reminder","skipIfConverted":true}',
  1,
  '${NOW}',
  '${NOW}'
);
SQL
echo "✓ Sequence 1 created: ${SEQ1_ID} (Casino Welcome - 4 steps)"

# ─── Sequence 2: DEPOSITOR_UPSELL ───────────────────────────────────────────
SEQ2_ID="seq_casino_depositor_upsell"

sqlite3 "$DB_PATH" <<SQL
INSERT OR IGNORE INTO RetentionSequence (id, name, description, status, channels, triggerType, triggerConfig, createdAt, updatedAt)
VALUES (
  '${SEQ2_ID}',
  'Casino Depositor Upsell',
  'Upsell sequence triggered after first deposit. Email immediately (deposit confirmed), SMS Day 3 (reload offer), Call Day 7 (VIP pitch for high-value depositors).',
  'ACTIVE',
  '["EMAIL","SMS","CALL"]',
  'manual',
  '{"triggerEvent":"first_deposit","project":"stake-social-casino","minDepositAmount":0}',
  '${NOW}',
  '${NOW}'
);

-- Step 1: Email immediately - Deposit confirmed
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_upsell_1',
  '${SEQ2_ID}',
  1,
  'EMAIL',
  0,
  'HOURS',
  '{"template":"casino_deposit_confirmed","emailTemplateId":"tpl_casino_deposit_confirmed","description":"Deposit confirmation + next deposit bonus"}',
  1,
  '${NOW}',
  '${NOW}'
);

-- Step 2: SMS Day 3 - Reload offer
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_upsell_2',
  '${SEQ2_ID}',
  2,
  'SMS',
  3,
  'DAYS',
  '{"template":"casino_reload_offer","description":"Reload bonus SMS - deposit again for extra coins"}',
  1,
  '${NOW}',
  '${NOW}'
);

-- Step 3: Call Day 7 - VIP pitch (high-value only)
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_upsell_3',
  '${SEQ2_ID}',
  3,
  'CALL',
  7,
  'DAYS',
  '{"template":"casino_vip_pitch","description":"VIP manager call for high-value depositors","minScoreLabel":"HOT","vapiConfig":{"assistantId":"casino_vip_pitch"}}',
  1,
  '${NOW}',
  '${NOW}'
);
SQL
echo "✓ Sequence 2 created: ${SEQ2_ID} (Depositor Upsell - 3 steps)"

# ─── Sequence 3: COMEBACK (Day 3-30 inactive) ───────────────────────────────
SEQ3_ID="seq_casino_comeback"

sqlite3 "$DB_PATH" <<SQL
INSERT OR IGNORE INTO RetentionSequence (id, name, description, status, channels, triggerType, triggerConfig, createdAt, updatedAt)
VALUES (
  '${SEQ3_ID}',
  'Casino Comeback (Inactive Players)',
  'Re-engagement sequence for inactive players. Push Day 3, Email Day 7, SMS Day 14, Call Day 30 (high-value only). Triggered when no activity for 3+ days.',
  'ACTIVE',
  '["PUSH","EMAIL","SMS","CALL"]',
  'no_conversion',
  '{"inactiveDays":3,"project":"stake-social-casino","triggerEvent":"player_inactive"}',
  '${NOW}',
  '${NOW}'
);

-- Step 1: Push Day 3 - We miss you
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_comeback_1',
  '${SEQ3_ID}',
  1,
  'PUSH',
  0,
  'HOURS',
  '{"template":"casino_miss_you_push","description":"Push notification - we miss you + free coins"}',
  1,
  '${NOW}',
  '${NOW}'
);

-- Step 2: Email Day 7 - Comeback bonus
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_comeback_2',
  '${SEQ3_ID}',
  2,
  'EMAIL',
  4,
  'DAYS',
  '{"template":"casino_comeback_email","emailTemplateId":"tpl_casino_comeback","description":"Comeback email with special bonus","skipIfConverted":true}',
  1,
  '${NOW}',
  '${NOW}'
);

-- Step 3: SMS Day 14 - Personal offer
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_comeback_3',
  '${SEQ3_ID}',
  3,
  'SMS',
  7,
  'DAYS',
  '{"template":"casino_personal_offer_sms","description":"Personalized SMS with comeback offer","skipIfConverted":true}',
  1,
  '${NOW}',
  '${NOW}'
);

-- Step 4: Call Day 30 - High-value only
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_comeback_4',
  '${SEQ3_ID}',
  4,
  'CALL',
  16,
  'DAYS',
  '{"template":"casino_comeback_call","description":"Personal call for high-value inactive players","minScoreLabel":"WARM","vapiConfig":{"assistantId":"casino_comeback_call"}}',
  1,
  '${NOW}',
  '${NOW}'
);
SQL
echo "✓ Sequence 3 created: ${SEQ3_ID} (Comeback - 4 steps)"

# ─── Sequence 4: VIP_NURTURE ────────────────────────────────────────────────
SEQ4_ID="seq_casino_vip_nurture"

sqlite3 "$DB_PATH" <<SQL
INSERT OR IGNORE INTO RetentionSequence (id, name, description, status, channels, triggerType, triggerConfig, createdAt, updatedAt)
VALUES (
  '${SEQ4_ID}',
  'Casino VIP Nurture',
  'Long-term VIP nurturing sequence. Weekly email (personalized game recs), Monthly SMS (cashback statement), Quarterly call (VIP manager intro). For high-value depositors.',
  'ACTIVE',
  '["EMAIL","SMS","CALL"]',
  'manual',
  '{"triggerEvent":"vip_qualified","project":"stake-social-casino","minScoreLabel":"HOT"}',
  '${NOW}',
  '${NOW}'
);

-- Step 1: Weekly email - Personalized game recommendations
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_vip_1',
  '${SEQ4_ID}',
  1,
  'EMAIL',
  0,
  'HOURS',
  '{"template":"casino_vip_game_recs","emailTemplateId":"tpl_casino_vip_weekly","description":"Weekly personalized game recommendations email"}',
  1,
  '${NOW}',
  '${NOW}'
);

-- Step 2: Monthly SMS - Cashback statement
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_vip_2',
  '${SEQ4_ID}',
  2,
  'SMS',
  4,
  'WEEKS',
  '{"template":"casino_vip_cashback","description":"Monthly cashback statement SMS"}',
  1,
  '${NOW}',
  '${NOW}'
);

-- Step 3: Quarterly call - VIP manager intro
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_vip_3',
  '${SEQ4_ID}',
  3,
  'CALL',
  12,
  'WEEKS',
  '{"template":"casino_vip_manager_call","description":"Quarterly VIP manager introduction call","vapiConfig":{"assistantId":"casino_vip_manager"}}',
  1,
  '${NOW}',
  '${NOW}'
);
SQL
echo "✓ Sequence 4 created: ${SEQ4_ID} (VIP Nurture - 3 steps)"

# ─── Sequence 5: HOT_STREAK ─────────────────────────────────────────────────
SEQ5_ID="seq_casino_hot_streak"

sqlite3 "$DB_PATH" <<SQL
INSERT OR IGNORE INTO RetentionSequence (id, name, description, status, channels, triggerType, triggerConfig, createdAt, updatedAt)
VALUES (
  '${SEQ5_ID}',
  'Casino Hot Streak',
  'Engagement sequence triggered on big wins or hot streaks. Push immediately (congratulate), Email 1h later (deposit to play for real), SMS next day (bonus offer).',
  'ACTIVE',
  '["PUSH","EMAIL","SMS"]',
  'manual',
  '{"triggerEvent":"hot_streak","project":"stake-social-casino","minWinAmount":1000}',
  '${NOW}',
  '${NOW}'
);

-- Step 1: Push immediately - Congratulations
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_hotstreak_1',
  '${SEQ5_ID}',
  1,
  'PUSH',
  0,
  'HOURS',
  '{"template":"casino_congrats_push","description":"Immediate push notification congratulating the win"}',
  1,
  '${NOW}',
  '${NOW}'
);

-- Step 2: Email 1h later - Deposit to play for real
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_hotstreak_2',
  '${SEQ5_ID}',
  2,
  'EMAIL',
  1,
  'HOURS',
  '{"template":"casino_deposit_cta","emailTemplateId":"tpl_casino_hot_streak","description":"Email encouraging real money deposit after big win"}',
  1,
  '${NOW}',
  '${NOW}'
);

-- Step 3: SMS next day - Bonus offer
INSERT OR IGNORE INTO SequenceStep (id, sequenceId, stepOrder, channel, delayValue, delayUnit, conditions, isActive, createdAt, updatedAt)
VALUES (
  'step_hotstreak_3',
  '${SEQ5_ID}',
  3,
  'SMS',
  1,
  'DAYS',
  '{"template":"casino_bonus_sms","description":"SMS bonus offer following up on hot streak"}',
  1,
  '${NOW}',
  '${NOW}'
);
SQL
echo "✓ Sequence 5 created: ${SEQ5_ID} (Hot Streak - 3 steps)"

# ─── Verify ──────────────────────────────────────────────────────────────────
echo ""
echo "=== Verification ==="
echo "Campaigns:"
sqlite3 "$DB_PATH" "SELECT id, name, status FROM Campaign WHERE id='${CAMPAIGN_ID}';"
echo ""
echo "Sequences:"
sqlite3 "$DB_PATH" "SELECT id, name, status, triggerType FROM RetentionSequence WHERE id LIKE 'seq_casino_%';"
echo ""
echo "Steps per sequence:"
sqlite3 "$DB_PATH" "SELECT s.name, COUNT(st.id) as steps FROM RetentionSequence s LEFT JOIN SequenceStep st ON st.sequenceId = s.id WHERE s.id LIKE 'seq_casino_%' GROUP BY s.id;"
echo ""
echo "All step details:"
sqlite3 "$DB_PATH" -header -column "SELECT st.id, s.name as sequence, st.stepOrder, st.channel, st.delayValue, st.delayUnit FROM SequenceStep st JOIN RetentionSequence s ON s.id = st.sequenceId WHERE s.id LIKE 'seq_casino_%' ORDER BY s.name, st.stepOrder;"

echo ""
echo "=== Sequence IDs for downstream tasks ==="
echo "WELCOME:          ${SEQ1_ID}"
echo "DEPOSITOR_UPSELL: ${SEQ2_ID}"
echo "COMEBACK:         ${SEQ3_ID}"
echo "VIP_NURTURE:      ${SEQ4_ID}"
echo "HOT_STREAK:       ${SEQ5_ID}"
echo "CAMPAIGN:         ${CAMPAIGN_ID}"
echo ""
echo "Done! Casino campaign + 5 sequences seeded."
