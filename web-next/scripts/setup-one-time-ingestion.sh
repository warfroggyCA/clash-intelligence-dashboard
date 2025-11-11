#!/bin/bash
# Setup one-time ingestion at 2:10 PM EST (19:10 UTC)

# Don't exit on error - we'll handle errors explicitly
set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_NAME="com.clashintelligence.ingestion.onetime"
PLIST_FILE="$SCRIPT_DIR/$PLIST_NAME.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
INSTALLED_PLIST="$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist"
LOG_DIR="$HOME/Library/Logs"

echo "🚀 Setting up one-time ingestion at 2:15 PM EST..."
echo ""
echo "⚠️  WARNING: LaunchAgent jobs scheduled close to execution time can be unreliable."
echo "   If scheduling less than 10 minutes before execution, consider using:"
echo "   npm run ingest:mac:onetime:at"
echo ""

# Get current date/time
CURRENT_DATE=$(date +%Y-%m-%d)
CURRENT_HOUR_UTC=$(date -u +%H | sed 's/^0//')  # Remove leading zero to avoid octal
CURRENT_MINUTE=$(date -u +%M | sed 's/^0//')    # Remove leading zero to avoid octal

# 2:15 PM EST = 19:15 UTC (EST is UTC-5)
TARGET_HOUR_UTC=19
TARGET_MINUTE=15

# Check if target time has passed today (handle empty strings)
CURRENT_HOUR_UTC=${CURRENT_HOUR_UTC:-0}
CURRENT_MINUTE=${CURRENT_MINUTE:-0}
CURRENT_TIME_MINUTES=$((CURRENT_HOUR_UTC * 60 + CURRENT_MINUTE))
TARGET_TIME_MINUTES=$((TARGET_HOUR_UTC * 60 + TARGET_MINUTE))

if [ $CURRENT_TIME_MINUTES -ge $TARGET_TIME_MINUTES ]; then
    echo "⚠️  2:15 PM EST has already passed today."
    echo "   Setting up for tomorrow at 2:15 PM EST (19:15 UTC)"
    TARGET_DATE=$(date -u -v+1d +%Y-%m-%d 2>/dev/null || date -u -d "+1 day" +%Y-%m-%d 2>/dev/null || echo "")
    if [ -z "$TARGET_DATE" ]; then
        echo "❌ ERROR: Could not calculate tomorrow's date"
        exit 1
    fi
else
    echo "✅ Setting up for today at 2:15 PM EST (19:15 UTC)"
    TARGET_DATE=$CURRENT_DATE
fi

# Find tsx path (same logic as main setup script)
TSX_PATH=$(which tsx)
if [ -z "$TSX_PATH" ]; then
    # Try local node_modules first
    if [ -f "$PROJECT_ROOT/node_modules/.bin/tsx" ]; then
        TSX_PATH="$PROJECT_ROOT/node_modules/.bin/tsx"
    else
        # Try npm's tsx
        TSX_PATH=$(npm list -g tsx 2>/dev/null | grep tsx | head -1 | awk '{print $NF}' || echo "")
        if [ -z "$TSX_PATH" ]; then
            TSX_PATH="npx"
            echo "⚠️  WARNING: tsx not found in PATH, will use npx tsx"
        fi
    fi
fi

# Create LaunchAgent plist content
cat > "$INSTALLED_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>$TSX_PATH</string>
        <string>$PROJECT_ROOT/scripts/mac-ingestion.ts</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>$PROJECT_ROOT</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/opt/homebrew/opt/node@20/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>NODE_ENV</key>
        <string>development</string>
        <key>COC_DISABLE_PROXY</key>
        <string>true</string>
    </dict>
    
    <key>StandardInPath</key>
    <string>/dev/null</string>
    
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/clash-intelligence-ingestion-onetime.log</string>
    
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/clash-intelligence-ingestion-onetime-error.log</string>
    
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>$TARGET_HOUR_UTC</integer>
        <key>Minute</key>
        <integer>$TARGET_MINUTE</integer>
    </dict>
    
    <key>RunAtLoad</key>
    <false/>
    
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
EOF

# If using npx, adjust ProgramArguments
if [ "$TSX_PATH" = "npx" ]; then
    /usr/libexec/PlistBuddy -c "Set :ProgramArguments:0 /usr/local/bin/npx" "$INSTALLED_PLIST" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Set :ProgramArguments:1 tsx" "$INSTALLED_PLIST" 2>/dev/null || true
fi

echo "✅ LaunchAgent plist created at: $INSTALLED_PLIST"
echo ""

# Unload existing agent if it exists
if launchctl list "$PLIST_NAME" &> /dev/null; then
    echo "🛑 Stopping existing one-time agent..."
    launchctl unload "$INSTALLED_PLIST" 2>/dev/null || true
fi

# Load the agent
echo "▶️  Loading LaunchAgent..."
launchctl load "$INSTALLED_PLIST"

if [ $? -eq 0 ]; then
    echo "✅ One-time ingestion scheduled successfully!"
    echo ""
    echo "📅 Scheduled for: $TARGET_DATE at 19:15 UTC (2:15 PM EST)"
    echo "📁 Logs: $LOG_DIR/clash-intelligence-ingestion-onetime.log"
    echo ""
    echo "To remove after it runs:"
    echo "  launchctl unload $INSTALLED_PLIST"
    echo "  rm $INSTALLED_PLIST"
    echo ""
else
    echo "❌ ERROR: Failed to load LaunchAgent"
    exit 1
fi

