#!/bin/bash

# Test CoC API endpoint
# This script will try to find your Vercel URL and test the endpoint

echo "🔍 Testing CoC API Endpoint..."
echo ""

# Try common URL patterns
URLS=(
  "https://clash-intelligence-new.vercel.app"
  "https://new-clash-intelligence.vercel.app"
  "https://clash-intelligence.vercel.app"
)

# Check if ADMIN_API_KEY is provided
if [ -z "$1" ]; then
  echo "❌ Usage: $0 YOUR_ADMIN_API_KEY"
  echo ""
  echo "To get your ADMIN_API_KEY:"
  echo "1. Go to https://vercel.com/dashboard"
  echo "2. Select your project"
  echo "3. Go to Settings → Environment Variables"
  echo "4. Find ADMIN_API_KEY or INGESTION_TRIGGER_KEY"
  echo ""
  exit 1
fi

API_KEY="$1"

# Try each URL
for URL in "${URLS[@]}"; do
  echo "Testing: $URL/api/debug/test-coc-api"
  
  response=$(curl -s -w "\n%{http_code}" \
    -X GET \
    "$URL/api/debug/test-coc-api" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" 2>&1)
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "403" ] || [ "$http_code" = "500" ]; then
    echo "✅ Found working URL: $URL"
    echo ""
    echo "HTTP Status: $http_code"
    echo ""
    echo "Response:"
    if command -v jq &> /dev/null; then
      echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
      echo "$body"
    fi
    exit 0
  elif [ "$http_code" = "401" ]; then
    echo "⚠️  Endpoint exists but authentication failed (check your API key)"
    echo "Response: $body"
    continue
  fi
done

echo "❌ Could not find working deployment URL"
echo "Please check your Vercel dashboard for the correct URL"
