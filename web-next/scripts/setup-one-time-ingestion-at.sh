#!/bin/bash
# Setup one-time ingestion using 'at' command (more reliable for near-term scheduling)
# Usage: bash scripts/setup-one-time-ingestion-at.sh [HH:MM] [AM/PM]

set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if 'at' command is available
if ! command -v at &> /dev/null; then
    echo "❌ ERROR: 'at' command not found."
    echo "   Install it with: brew install at"
    exit 1
fi

# Check if atd is running
if ! pgrep -x atd > /dev/null; then
    echo "⚠️  WARNING: atd daemon is not running."
    echo "   Starting it with: sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.atrun.plist"
    echo "   (You may need to enter your password)"
    sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.atrun.plist 2>/dev/null || {
        echo "❌ Failed to start atd. Please run manually:"
        echo "   sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.atrun.plist"
        exit 1
    }
fi

# Parse time argument or use default
if [ -n "$1" ]; then
    TARGET_TIME="$1"
    if [ -n "$2" ]; then
        TARGET_TIME="$1 $2"
    fi
else
    # Default: 2:15 PM EST (19:15 UTC)
    TARGET_TIME="19:15"
fi

echo "🚀 Setting up one-time ingestion using 'at' command..."
echo "📅 Scheduled for: $TARGET_TIME UTC"
echo ""

# Create a temporary script that will be executed by 'at'
TEMP_SCRIPT=$(mktemp)
cat > "$TEMP_SCRIPT" <<'SCRIPT_EOF'
#!/bin/bash
cd "ABSOLUTE_PATH_TO_WEB_NEXT"
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@20/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NODE_ENV="development"
export COC_DISABLE_PROXY="true"
source .env.local 2>/dev/null || true
npm run ingest:mac >> ~/Library/Logs/clash-intelligence-ingestion-onetime.log 2>&1
SCRIPT_EOF

# Replace placeholder with actual path
sed -i '' "s|ABSOLUTE_PATH_TO_WEB_NEXT|$PROJECT_ROOT|g" "$TEMP_SCRIPT"
chmod +x "$TEMP_SCRIPT"

# Schedule with 'at'
echo "$TEMP_SCRIPT" | at "$TARGET_TIME" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ One-time ingestion scheduled successfully!"
    echo ""
    echo "📅 Scheduled for: $TARGET_TIME UTC"
    echo "📁 Logs: ~/Library/Logs/clash-intelligence-ingestion-onetime.log"
    echo ""
    echo "To view scheduled jobs:"
    echo "  atq"
    echo ""
    echo "To remove a scheduled job:"
    echo "  atrm <job_number>"
    echo ""
    echo "Current scheduled jobs:"
    atq
else
    echo "❌ ERROR: Failed to schedule job with 'at'"
    rm "$TEMP_SCRIPT"
    exit 1
fi

