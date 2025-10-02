#!/bin/bash

# Verification script for nightly ingestion setup
# This script helps verify that all components are properly configured

set -e

echo "🔍 Verifying Nightly Ingestion Setup..."
echo "======================================"

# Check if we have the required environment variables
if [ -z "$APP_BASE_URL" ]; then
    echo "❌ APP_BASE_URL environment variable not set"
    echo "   Set this to your production URL (e.g., https://your-app.vercel.app)"
    exit 1
fi

if [ -z "$ADMIN_API_KEY" ]; then
    echo "❌ ADMIN_API_KEY environment variable not set"
    echo "   Set this to match your deployment's ADMIN_API_KEY"
    exit 1
fi

echo "✅ Environment variables configured"

# Test the health endpoint
echo ""
echo "🏥 Testing ingestion health endpoint..."
HEALTH_URL="${APP_BASE_URL}/api/ingestion/health?clanTag=%232PR8R8V8P"
echo "   URL: $HEALTH_URL"

HEALTH_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$HEALTH_URL")
HTTP_CODE="${HEALTH_RESPONSE: -3}"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health endpoint accessible"
    
    # Parse and display key information
    if command -v jq &> /dev/null; then
        echo "   Status: $(jq -r '.data.status // "unknown"' /tmp/health_response.json)"
        echo "   Last Job ID: $(jq -r '.data.jobId // "none"' /tmp/health_response.json)"
        echo "   Total Duration: $(jq -r '.data.totalDurationMs // 0' /tmp/health_response.json)ms"
        echo "   Anomalies: $(jq -r '.data.anomalies | length' /tmp/health_response.json)"
    else
        echo "   Response received (install jq for detailed parsing)"
    fi
else
    echo "❌ Health endpoint returned HTTP $HTTP_CODE"
    echo "   Response: $(cat /tmp/health_response.json)"
    exit 1
fi

# Test the admin endpoint (dry run)
echo ""
echo "🔐 Testing admin endpoint authorization..."
ADMIN_URL="${APP_BASE_URL}/api/admin/run-staged-ingestion"
echo "   URL: $ADMIN_URL"

# Test with invalid key first
INVALID_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/admin_invalid.json \
    -X POST "$ADMIN_URL" \
    -H "Content-Type: application/json" \
    -H "x-api-key: invalid-key" \
    -d '{}')

INVALID_HTTP_CODE="${INVALID_RESPONSE: -3}"

if [ "$INVALID_HTTP_CODE" = "401" ]; then
    echo "✅ Admin endpoint properly rejects invalid API keys"
else
    echo "⚠️  Admin endpoint returned HTTP $INVALID_HTTP_CODE (expected 401)"
fi

# Test with valid key (this will actually trigger ingestion)
echo ""
echo "🚀 Testing admin endpoint with valid key..."
echo "   ⚠️  This will trigger an actual ingestion job!"

read -p "   Continue? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    VALID_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/admin_valid.json \
        -X POST "$ADMIN_URL" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $ADMIN_API_KEY" \
        -d '{}')
    
    VALID_HTTP_CODE="${VALID_RESPONSE: -3}"
    
    if [ "$VALID_HTTP_CODE" = "200" ]; then
        echo "✅ Admin endpoint accepted valid API key"
        if command -v jq &> /dev/null; then
            echo "   Success: $(jq -r '.success' /tmp/admin_valid.json)"
            echo "   Clan Tag: $(jq -r '.clanTag' /tmp/admin_valid.json)"
        fi
    else
        echo "❌ Admin endpoint returned HTTP $VALID_HTTP_CODE"
        echo "   Response: $(cat /tmp/admin_valid.json)"
    fi
else
    echo "   Skipped admin endpoint test"
fi

# Cleanup
rm -f /tmp/health_response.json /tmp/admin_invalid.json /tmp/admin_valid.json

echo ""
echo "🎉 Verification complete!"
echo ""
echo "Next steps:"
echo "1. Apply the Supabase migration (see NIGHTLY_INGESTION_SETUP.md)"
echo "2. Configure GitHub secrets (APP_BASE_URL, ADMIN_API_KEY)"
echo "3. Test the GitHub Actions workflow manually"
echo "4. Verify tenure data is populated in Supabase"
