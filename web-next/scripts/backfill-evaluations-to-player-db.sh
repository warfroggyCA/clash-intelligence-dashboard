#!/bin/bash

# Script to backfill applicant evaluations to Player Database
# Usage: ./scripts/backfill-evaluations-to-player-db.sh [clanTag] [dryRun]

set -e

CLAN_TAG="${1:-#2PR8R8V8P}"
DRY_RUN="${2:-true}"

# Get ADMIN_API_KEY from environment or prompt
if [ -z "$ADMIN_API_KEY" ]; then
  echo "⚠️  ADMIN_API_KEY not set in environment"
  echo "Please set it: export ADMIN_API_KEY=your_key_here"
  exit 1
fi

API_URL="${API_URL:-http://localhost:5050}"

echo "🔄 Backfilling applicant evaluations to Player Database..."
echo "   Clan Tag: $CLAN_TAG"
echo "   Dry Run: $DRY_RUN"
echo "   API URL: $API_URL"
echo ""

# First, do a dry run to see what would be migrated
echo "📊 Running dry run to preview changes..."
DRY_RUN_RESULT=$(curl -s -X POST "$API_URL/api/admin/backfill-evaluations-to-player-db" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d "{\"clanTag\": \"$CLAN_TAG\", \"dryRun\": true}")

echo "$DRY_RUN_RESULT" | jq '.'

# Ask for confirmation if not dry run
if [ "$DRY_RUN" = "false" ]; then
  echo ""
  read -p "⚠️  This will create notes in the Player Database. Continue? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "❌ Cancelled"
    exit 0
  fi

  echo ""
  echo "🚀 Running actual backfill..."
  RESULT=$(curl -s -X POST "$API_URL/api/admin/backfill-evaluations-to-player-db" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_API_KEY" \
    -d "{\"clanTag\": \"$CLAN_TAG\", \"dryRun\": false}")

  echo "$RESULT" | jq '.'
  echo ""
  echo "✅ Backfill complete!"
else
  echo ""
  echo "💡 To actually run the backfill, use:"
  echo "   $0 $CLAN_TAG false"
fi

