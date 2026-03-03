#!/bin/bash
# Seed the stake-social webhook config for casino lead ingestion
# Run: bash scripts/seed-casino-webhook.sh [db-path]

DB_PATH="${1:-dev.db}"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

echo "Seeding casino webhook into: $DB_PATH"

# Field mapping: casino payload fields -> RC lead fields
FIELD_MAPPING='{"user_id":"externalId","first_name":"firstName","last_name":"lastName","email":"email","phone":"phone"}'
CONFIG='{"description":"Receives user registrations and events from Stake Social Casino","endpoint":"/api/webhooks/casino","authMethod":"hmac_sha256 or x-api-key"}'

# Link to the casino acquisition campaign if it exists
CAMPAIGN_ID=$(sqlite3 "$DB_PATH" "SELECT id FROM Campaign WHERE id='casino_acq_001' LIMIT 1;" 2>/dev/null)

# Link to casino welcome sequence if it exists
SEQUENCE_ID=$(sqlite3 "$DB_PATH" "SELECT id FROM RetentionSequence WHERE id='seq_casino_welcome' LIMIT 1;" 2>/dev/null)

if [ -n "$CAMPAIGN_ID" ]; then
  echo "  Found campaign: $CAMPAIGN_ID"
  CAMPAIGN_SQL="'${CAMPAIGN_ID}'"
else
  echo "  No casino campaign found (will route via LeadRouter)"
  CAMPAIGN_SQL="NULL"
fi

if [ -n "$SEQUENCE_ID" ]; then
  echo "  Found welcome sequence: $SEQUENCE_ID"
  SEQUENCE_SQL="'${SEQUENCE_ID}'"
else
  echo "  No casino welcome sequence found"
  SEQUENCE_SQL="NULL"
fi

WEBHOOK_ID="wh_stake_social"

sqlite3 "$DB_PATH" <<SQL
INSERT OR REPLACE INTO Webhook (id, name, slug, type, sourceLabel, isActive, config, fieldMapping, campaignId, sequenceId, leadCount, createdAt, updatedAt)
VALUES (
  '${WEBHOOK_ID}',
  'Stake Social Casino',
  'stake-social',
  'generic',
  'STAKE_SOCIAL',
  1,
  '${CONFIG}',
  '${FIELD_MAPPING}',
  ${CAMPAIGN_SQL},
  ${SEQUENCE_SQL},
  0,
  '${NOW}',
  '${NOW}'
);
SQL

echo ""
echo "=== Verification ==="
sqlite3 "$DB_PATH" -header -column "SELECT id, name, slug, type, sourceLabel, isActive, campaignId, sequenceId FROM Webhook WHERE slug='stake-social';"
echo ""
echo "Field mapping:"
sqlite3 "$DB_PATH" "SELECT fieldMapping FROM Webhook WHERE slug='stake-social';"
echo ""
echo "Casino webhook endpoint: POST https://ag2.q37fh758g.click/api/webhooks/casino"
echo "Auth methods:"
echo "  1. X-API-Key header with RC's SERVICE_API_KEY"
echo "  2. X-Webhook-Signature header with HMAC-SHA256(body, CASINO_WEBHOOK_SECRET)"
echo ""
echo "Keitaro postback URL:"
echo "  https://ag2.q37fh758g.click/api/webhooks/keitaro?secret=<KEITARO_WEBHOOK_SECRET>&sub_id={subid}&status={status}&payout={payout}"
echo ""
echo "Done!"
