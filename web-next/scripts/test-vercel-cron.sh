#!/bin/bash
# Script to manually test the Vercel cron endpoint
# Tests the Mac check logic by triggering the endpoint

set -e

echo "🧪 Testing Vercel Cron Endpoint (Mac Check Logic)"
echo ""

# Get Vercel URL
if [ -z "$1" ]; then
  echo "Usage: $0 <VERCEL_URL> [CRON_SECRET]"
  echo ""
  echo "Example:"
  echo "  $0 https://clash-intelligence-new.vercel.app"
  echo ""
  echo "To find your Vercel URL:"
  echo "  1. Go to https://vercel.com/dashboard"
  echo "  2. Select your project"
  echo "  3. Copy the production URL"
  echo ""
  echo "CRON_SECRET:"
  echo "  - If not provided, will try to read from .env.local"
  echo "  - Or get from Vercel Dashboard → Settings → Environment Variables"
  exit 1
fi

VERCEL_URL="$1"
CRON_SECRET="${2:-}"

# Try to get CRON_SECRET from .env.local if not provided
if [ -z "$CRON_SECRET" ]; then
  if [ -f ".env.local" ]; then
    CRON_SECRET=$(grep "^CRON_SECRET=" .env.local | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "")
  fi
fi

if [ -z "$CRON_SECRET" ]; then
  echo "❌ CRON_SECRET not found. Please provide it as second argument:"
  echo "   $0 $VERCEL_URL your-cron-secret-value"
  echo ""
  echo "Or set it in .env.local as: CRON_SECRET=your-secret"
  exit 1
fi

ENDPOINT="${VERCEL_URL}/api/cron/daily-ingestion"

echo "📡 Endpoint: $ENDPOINT"
echo "🔑 Using CRON_SECRET: ${CRON_SECRET:0:10}..."
echo ""
echo "🚀 Triggering endpoint..."
echo ""

# Make the request
response=$(curl -s -w "\n%{http_code}" \
  -X GET \
  "$ENDPOINT" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" 2>&1)

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "📊 HTTP Status: $http_code"
echo ""
echo "📄 Response:"
echo ""

# Pretty print JSON if jq is available
if command -v jq &> /dev/null; then
  echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
  echo "$body"
fi

echo ""
echo "---"
echo ""

# Interpret the response
if [ "$http_code" = "200" ]; then
  if echo "$body" | grep -q '"skipped":true'; then
    echo "✅ SUCCESS: Endpoint skipped execution (Mac already ran)"
    echo "   This confirms the Mac check logic is working!"
  elif echo "$body" | grep -q '"success":true'; then
    echo "✅ SUCCESS: Endpoint executed ingestion (Mac did not run)"
    echo "   This confirms the fallback logic is working!"
  else
    echo "⚠️  Response indicates success but check the details above"
  fi
elif [ "$http_code" = "401" ]; then
  echo "❌ AUTHENTICATION FAILED"
  echo "   Check that CRON_SECRET matches the value in Vercel"
elif [ "$http_code" = "500" ]; then
  echo "❌ SERVER ERROR"
  echo "   Check Vercel logs for details"
else
  echo "⚠️  Unexpected status code: $http_code"
fi

