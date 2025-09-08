#!/bin/bash

# Simple setup script for daily snapshots
echo "🚀 Setting up Daily Clan Snapshots..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the web-next directory"
    exit 1
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found. Please create it with your API keys."
    exit 1
fi

echo "✅ Found .env.local"

# Test the API endpoints
echo "🧪 Testing API endpoints..."

# Test snapshot creation
echo "Testing snapshot creation..."
SNAPSHOT_RESULT=$(curl -s -X POST "http://localhost:5050/api/snapshots/create" \
    -H "Content-Type: application/json" \
    -d '{"clanTag":"#2PR8R8V8P"}')

if echo "$SNAPSHOT_RESULT" | jq -e '.success' > /dev/null; then
    echo "✅ Snapshot creation works"
else
    echo "❌ Snapshot creation failed"
    echo "$SNAPSHOT_RESULT"
fi

# Test cron endpoint
echo "Testing cron endpoint..."
CRON_RESULT=$(curl -s "http://localhost:5050/api/cron/daily-snapshot")

if echo "$CRON_RESULT" | jq -e '.success' > /dev/null; then
    echo "✅ Cron endpoint works"
else
    echo "❌ Cron endpoint failed"
    echo "$CRON_RESULT"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Visit http://localhost:5050 and click the 'Activity Dashboard' tab"
echo "2. Choose your deployment method:"
echo ""
echo "   Option A - GitHub Actions (Recommended):"
echo "   - Push this code to GitHub"
echo "   - Go to Settings > Secrets and add:"
echo "     - CRON_SECRET: any random string (e.g., 'my-secret-key-123')"
echo "     - APP_URL: your deployed app URL (e.g., 'https://your-app.vercel.app')"
echo ""
echo "   Option B - Local Crontab:"
echo "   - Run: crontab -e"
echo "   - Add: 0 3 * * * curl http://localhost:5050/api/cron/daily-snapshot"
echo ""
echo "   Option C - Manual Testing:"
echo "   - Run: curl http://localhost:5050/api/cron/daily-snapshot"
echo "   - Or visit: http://localhost:5050/api/cron/daily-snapshot"
echo ""
echo "🎉 Setup complete! Your smart notification system is ready."
