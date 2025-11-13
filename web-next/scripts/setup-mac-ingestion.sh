#!/bin/bash
# Setup script for Mac-based ingestion cron job
# Installs LaunchAgent to run ingestion daily at 3 AM UTC

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_NAME="com.clashintelligence.ingestion"
PLIST_FILE="$SCRIPT_DIR/$PLIST_NAME.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
INSTALLED_PLIST="$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist"
LOG_DIR="$HOME/Library/Logs"

echo "🚀 Setting up Mac ingestion cron job..."
echo ""

# Check if npm/node are available
if ! command -v npm &> /dev/null; then
    echo "❌ ERROR: npm not found. Please install Node.js first."
    exit 1
fi

if ! command -v tsx &> /dev/null && ! npm list -g tsx &> /dev/null; then
    echo "⚠️  WARNING: tsx not found globally. Installing..."
    npm install -g tsx
fi

# Load environment variables from .env.local if it exists
ENV_FILE="$PROJECT_ROOT/.env.local"
if [ -f "$ENV_FILE" ]; then
    echo "📋 Loading environment variables from .env.local..."
    set -a
    source "$ENV_FILE"
    set +a
fi

# Check environment variables
echo "📋 Checking environment variables..."
MISSING_VARS=()

if [ -z "$COC_API_TOKEN" ] && [ -z "$COC_API_KEY" ]; then
    MISSING_VARS+=("COC_API_TOKEN or COC_API_KEY")
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    MISSING_VARS+=("SUPABASE_SERVICE_ROLE_KEY")
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    MISSING_VARS+=("NEXT_PUBLIC_SUPABASE_URL")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "❌ ERROR: Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please set these in your .env.local file or export them before running this script."
    exit 1
fi

echo "✅ Environment variables check passed"
echo ""

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$LAUNCH_AGENTS_DIR"
mkdir -p "$LOG_DIR"

# Find tsx path
TSX_PATH=$(which tsx)
if [ -z "$TSX_PATH" ]; then
    # Try npm's tsx
    TSX_PATH=$(npm list -g tsx 2>/dev/null | grep tsx | head -1 | awk '{print $NF}' || echo "")
    if [ -z "$TSX_PATH" ]; then
        # Try npx
        TSX_PATH="npx"
        echo "⚠️  WARNING: tsx not found in PATH, will use npx tsx"
    fi
fi

# Update plist with actual project path, tsx path, and home directory
echo "📝 Creating LaunchAgent plist..."
sed -e "s|ABSOLUTE_PATH_TO_WEB_NEXT|$PROJECT_ROOT|g" \
    -e "s|TSX_PATH|$TSX_PATH|g" \
    -e "s|HOME_LIBRARY_LOGS|$HOME/Library/Logs|g" \
    "$PLIST_FILE" > "$INSTALLED_PLIST"

# If using npx, we need to adjust the ProgramArguments
if [ "$TSX_PATH" = "npx" ]; then
    /usr/libexec/PlistBuddy -c "Set :ProgramArguments:0 /usr/local/bin/npx" "$INSTALLED_PLIST" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Set :ProgramArguments:1 tsx" "$INSTALLED_PLIST" 2>/dev/null || true
    # Ensure --all flag is present (should already be there from template)
    /usr/libexec/PlistBuddy -c "Add :ProgramArguments:3 string --all" "$INSTALLED_PLIST" 2>/dev/null || true
fi

echo "✅ LaunchAgent plist created at: $INSTALLED_PLIST"
echo ""

# Unload existing agent if it exists
if launchctl list "$PLIST_NAME" &> /dev/null; then
    echo "🛑 Stopping existing agent..."
    launchctl unload "$INSTALLED_PLIST" 2>/dev/null || true
fi

# Load the agent
echo "▶️  Loading LaunchAgent..."
launchctl load "$INSTALLED_PLIST"

if [ $? -eq 0 ]; then
    echo "✅ LaunchAgent loaded successfully!"
    echo ""
    echo "📅 Schedule: Daily at 11:30 PM EST (4:30 AM UTC) and 12:30 AM EST (5:30 AM UTC)"
    echo "📁 Logs: $LOG_DIR/clash-intelligence-ingestion.log"
    echo ""
    echo "Useful commands:"
    echo "  npm run ingest:mac:status  - Check status"
    echo "  npm run ingest:mac:stop    - Stop cron"
    echo "  npm run ingest:mac:start  - Start cron"
    echo "  npm run ingest:mac         - Run manually"
    echo ""
else
    echo "❌ ERROR: Failed to load LaunchAgent"
    exit 1
fi

