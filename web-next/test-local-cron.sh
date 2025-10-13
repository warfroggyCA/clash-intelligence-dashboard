#!/bin/bash

# Local Cron Test Script
# This simulates what Vercel cron would do

CRON_SECRET=$(grep CRON_SECRET .env.local | cut -d '=' -f2)

echo "🔄 Triggering local ingestion (simulating Vercel cron)..."
echo "Using CRON_SECRET from .env.local"

curl -X POST http://localhost:3000/api/cron/daily-ingestion \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  | jq '.'

echo ""
echo "✅ Local ingestion complete!"
echo ""
echo "To run this daily, add to your system crontab:"
echo "0 3 * * * cd /app/web-next && ./test-local-cron.sh"
