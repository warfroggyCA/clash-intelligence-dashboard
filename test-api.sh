#!/bin/bash

# Test CoC API endpoint
# Usage: ./test-api.sh YOUR_APP_URL YOUR_ADMIN_API_KEY

APP_URL="${1:-https://your-app.vercel.app}"
API_KEY="${2}"

if [ -z "$API_KEY" ]; then
  echo "Usage: $0 YOUR_APP_URL YOUR_ADMIN_API_KEY"
  echo ""
  echo "Example:"
  echo "  $0 https://clash-intelligence.vercel.app my-secret-key"
  exit 1
fi

echo "Testing CoC API endpoint..."
echo "URL: $APP_URL/api/debug/test-coc-api"
echo ""

response=$(curl -s -w "\n%{http_code}" \
  -X GET \
  "$APP_URL/api/debug/test-coc-api" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "HTTP Status: $http_code"
echo ""
echo "Response:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"

