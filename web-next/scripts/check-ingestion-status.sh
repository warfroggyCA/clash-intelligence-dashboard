#!/bin/bash
# Check if Mac ingestion cron jobs ran successfully
# Usage: bash scripts/check-ingestion-status.sh

echo "🔍 Checking Mac Ingestion Status..."
echo ""

# Check LaunchAgent status
echo "📋 LaunchAgent Status:"
launchctl list com.clashintelligence.ingestion 2>&1 | grep -E "Label|LastExitStatus|PID" || echo "  ⚠️  Not loaded"
echo ""

# Check log file timestamps
LOG_FILE="$HOME/Library/Logs/clash-intelligence-ingestion.log"
if [ -f "$LOG_FILE" ]; then
    LAST_MODIFIED=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$LOG_FILE" 2>/dev/null || stat -c "%y" "$LOG_FILE" 2>/dev/null | cut -d'.' -f1)
    echo "📁 Log File: $LOG_FILE"
    echo "   Last modified: $LAST_MODIFIED"
    
    # Check if log was updated today
    TODAY=$(date +%Y-%m-%d)
    LOG_DATE=$(echo "$LAST_MODIFIED" | cut -d' ' -f1)
    
    if [ "$LOG_DATE" = "$TODAY" ]; then
        echo "   ✅ Log updated today"
    else
        echo "   ⚠️  Log NOT updated today (last: $LOG_DATE)"
    fi
    
    # Show last few log entries
    echo ""
    echo "📝 Last 10 log entries:"
    tail -10 "$LOG_FILE" | sed 's/^/   /'
else
    echo "   ❌ Log file not found"
fi

echo ""

# Check error log
ERROR_LOG="$HOME/Library/Logs/clash-intelligence-ingestion-error.log"
if [ -f "$ERROR_LOG" ] && [ -s "$ERROR_LOG" ]; then
    echo "⚠️  Error Log (last 5 entries):"
    tail -5 "$ERROR_LOG" | sed 's/^/   /'
    echo ""
fi

# Check database for today's snapshot (if we can connect)
echo "💾 Database Check:"
echo "   (Run manually: Check Supabase for today's snapshot in canonical_member_snapshots table)"
echo "   Expected: snapshot_date = $(date -u +%Y-%m-%d)"
echo ""

# Check if jobs should have run today
CURRENT_HOUR_UTC=$(date -u +%H | sed 's/^0//')
CURRENT_HOUR_UTC=${CURRENT_HOUR_UTC:-0}

if [ $CURRENT_HOUR_UTC -ge 6 ]; then
    echo "⏰ Status: Jobs should have run by now (past 6:00 AM UTC)"
    echo ""
    echo "🔧 If jobs didn't run, try:"
    echo "   1. Check LaunchAgent: launchctl list com.clashintelligence.ingestion"
    echo "   2. Reload: npm run ingest:mac:stop && npm run ingest:mac:start"
    echo "   3. Run manually: npm run ingest:mac"
    echo "   4. Check logs: tail -f ~/Library/Logs/clash-intelligence-ingestion.log"
else
    echo "⏰ Status: Jobs scheduled for 4:30 AM and 5:30 AM UTC"
    echo "   Current UTC time: $(date -u +%H:%M)"
    echo "   Jobs haven't run yet today (or still running)"
fi

echo ""

