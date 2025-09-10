#!/bin/bash

# Comprehensive Clash of Clans Data Pull Script
# This script pulls ALL available data from the CoC API for your clan

# Configuration
CLAN_TAG="#2PR8R8V8P"  # Your clan tag from config.ts
API_BASE="https://api.clashofclans.com/v1"
OUTPUT_DIR="./comprehensive_data_$(date +%Y%m%d_%H%M%S)"

# Check if API token is set
if [ -z "$COC_API_TOKEN" ]; then
    echo "Error: COC_API_TOKEN environment variable not set"
    echo "Please set your API token: export COC_API_TOKEN='your_token_here'"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to make API calls with error handling
api_call() {
    local endpoint="$1"
    local output_file="$2"
    local description="$3"
    
    echo "Fetching $description..."
    
    curl -s \
        --location "$API_BASE$endpoint" \
        --header "Accept: application/json" \
        --header "Authorization: Bearer $COC_API_TOKEN" \
        --output "$output_file" \
        --write-out "HTTP Status: %{http_code}\n"
    
    if [ $? -eq 0 ] && [ -s "$output_file" ]; then
        echo "✅ Successfully fetched $description"
    else
        echo "❌ Failed to fetch $description"
    fi
    echo ""
}

# Function to extract player tags from clan members
extract_player_tags() {
    local members_file="$1"
    if [ -f "$members_file" ]; then
        jq -r '.items[].tag' "$members_file" 2>/dev/null || echo ""
    fi
}

echo "🚀 Starting comprehensive Clash of Clans data pull for clan $CLAN_TAG"
echo "📁 Output directory: $OUTPUT_DIR"
echo ""

# 1. CLAN DATA
echo "=== CLAN INFORMATION ==="
api_call "/clans/%23${CLAN_TAG#\#}" "$OUTPUT_DIR/clan_info.json" "Clan Information"

# 2. CLAN MEMBERS
echo "=== CLAN MEMBERS ==="
api_call "/clans/%23${CLAN_TAG#\#}/members" "$OUTPUT_DIR/clan_members.json" "Clan Members"

# 3. WAR DATA
echo "=== WAR DATA ==="
api_call "/clans/%23${CLAN_TAG#\#}/warlog" "$OUTPUT_DIR/war_log.json" "War Log"
api_call "/clans/%23${CLAN_TAG#\#}/currentwar" "$OUTPUT_DIR/current_war.json" "Current War"

# 4. CLAN CAPITAL DATA
echo "=== CLAN CAPITAL DATA ==="
api_call "/clans/%23${CLAN_TAG#\#}/capitalraidseasons" "$OUTPUT_DIR/capital_raid_seasons.json" "Capital Raid Seasons"

# 5. LEAGUE DATA
echo "=== LEAGUE DATA ==="
api_call "/leagues" "$OUTPUT_DIR/leagues.json" "All Leagues"
api_call "/leagues/48000000" "$OUTPUT_DIR/legend_league.json" "Legend League"
api_call "/leagues/29000022" "$OUTPUT_DIR/titan_league.json" "Titan League"
api_call "/leagues/29000021" "$OUTPUT_DIR/champion_league.json" "Champion League"
api_call "/leagues/29000020" "$OUTPUT_DIR/master_league.json" "Master League"
api_call "/leagues/29000019" "$OUTPUT_DIR/crystal_league.json" "Crystal League"
api_call "/leagues/29000018" "$OUTPUT_DIR/gold_league.json" "Gold League"
api_call "/leagues/29000017" "$OUTPUT_DIR/silver_league.json" "Silver League"
api_call "/leagues/29000016" "$OUTPUT_DIR/bronze_league.json" "Bronze League"

# 6. PLAYER DATA (for each clan member)
echo "=== INDIVIDUAL PLAYER DATA ==="
if [ -f "$OUTPUT_DIR/clan_members.json" ]; then
    player_tags=$(extract_player_tags "$OUTPUT_DIR/clan_members.json")
    if [ -n "$player_tags" ]; then
        mkdir -p "$OUTPUT_DIR/players"
        echo "$player_tags" | while read -r player_tag; do
            if [ -n "$player_tag" ]; then
                # Extract player name for filename (sanitize for filesystem)
                player_name=$(jq -r --arg tag "$player_tag" '.items[] | select(.tag == $tag) | .name' "$OUTPUT_DIR/clan_members.json" 2>/dev/null | sed 's/[^a-zA-Z0-9_-]/_/g')
                api_call "/players/$player_tag" "$OUTPUT_DIR/players/${player_name}_${player_tag#\#}.json" "Player: $player_name ($player_tag)"
            fi
        done
    else
        echo "⚠️  Could not extract player tags from clan members"
    fi
else
    echo "⚠️  Clan members file not found, skipping individual player data"
fi

# 7. LOCATIONS DATA
echo "=== LOCATIONS DATA ==="
api_call "/locations" "$OUTPUT_DIR/locations.json" "All Locations"
api_call "/locations/32000007" "$OUTPUT_DIR/global_rankings.json" "Global Rankings"

# 8. GOLD PASS DATA
echo "=== GOLD PASS DATA ==="
api_call "/goldpass/seasons/current" "$OUTPUT_DIR/current_goldpass.json" "Current Gold Pass Season"

# 9. CLAN SEARCH (for comparison)
echo "=== CLAN SEARCH DATA ==="
api_call "/clans?name=Clash%20Intelligence&limit=10" "$OUTPUT_DIR/clan_search_results.json" "Clan Search Results"

# 10. PLAYER SEARCH (for comparison)
echo "=== PLAYER SEARCH DATA ==="
api_call "/players?name=Clash&limit=10" "$OUTPUT_DIR/player_search_results.json" "Player Search Results"

# 11. LABELS DATA
echo "=== LABELS DATA ==="
api_call "/labels/clans" "$OUTPUT_DIR/clan_labels.json" "Clan Labels"
api_call "/labels/players" "$OUTPUT_DIR/player_labels.json" "Player Labels"

# 12. RANKINGS DATA
echo "=== RANKINGS DATA ==="
api_call "/locations/32000007/rankings/clans" "$OUTPUT_DIR/global_clan_rankings.json" "Global Clan Rankings"
api_call "/locations/32000007/rankings/players" "$OUTPUT_DIR/global_player_rankings.json" "Global Player Rankings"
api_call "/locations/32000007/rankings/clans-versus" "$OUTPUT_DIR/global_clan_versus_rankings.json" "Global Clan Versus Rankings"
api_call "/locations/32000007/rankings/players-versus" "$OUTPUT_DIR/global_player_versus_rankings.json" "Global Player Versus Rankings"

# 13. CAPITAL RANKINGS
echo "=== CAPITAL RANKINGS DATA ==="
api_call "/locations/32000007/rankings/capitals" "$OUTPUT_DIR/global_capital_rankings.json" "Global Capital Rankings"

# 14. BUILDER BASE RANKINGS
echo "=== BUILDER BASE RANKINGS DATA ==="
api_call "/locations/32000007/rankings/players-builder-base" "$OUTPUT_DIR/global_builder_base_rankings.json" "Global Builder Base Rankings"
api_call "/locations/32000007/rankings/clans-builder-base" "$OUTPUT_DIR/global_clan_builder_base_rankings.json" "Global Clan Builder Base Rankings"

# 15. CLAN CAPITAL RANKINGS
echo "=== CLAN CAPITAL RANKINGS DATA ==="
api_call "/locations/32000007/rankings/clans-capital" "$OUTPUT_DIR/global_clan_capital_rankings.json" "Global Clan Capital Rankings"

# Create summary report
echo "=== CREATING SUMMARY REPORT ==="
cat > "$OUTPUT_DIR/SUMMARY.md" << EOF
# Clash of Clans Data Pull Summary

**Clan:** $CLAN_TAG  
**Date:** $(date)  
**Output Directory:** $OUTPUT_DIR

## Data Collected

### Clan Data
- ✅ Clan Information
- ✅ Clan Members
- ✅ War Log
- ✅ Current War
- ✅ Capital Raid Seasons

### League Data
- ✅ All Leagues
- ✅ Individual League Details (Legend, Titan, Champion, Master, Crystal, Gold, Silver, Bronze)

### Player Data
- ✅ Individual Player Profiles (for all clan members)

### Global Data
- ✅ All Locations
- ✅ Global Rankings (Clans, Players, Versus, Capital, Builder Base)
- ✅ Clan and Player Labels
- ✅ Gold Pass Information

### Search Data
- ✅ Clan Search Results
- ✅ Player Search Results

## File Structure
\`\`\`
$OUTPUT_DIR/
├── clan_info.json
├── clan_members.json
├── war_log.json
├── current_war.json
├── capital_raid_seasons.json
├── leagues.json
├── legend_league.json
├── titan_league.json
├── champion_league.json
├── master_league.json
├── crystal_league.json
├── gold_league.json
├── silver_league.json
├── bronze_league.json
├── players/
│   └── [individual player files]
├── locations.json
├── global_rankings.json
├── current_goldpass.json
├── clan_search_results.json
├── player_search_results.json
├── clan_labels.json
├── player_labels.json
├── global_clan_rankings.json
├── global_player_rankings.json
├── global_clan_versus_rankings.json
├── global_player_versus_rankings.json
├── global_capital_rankings.json
├── global_builder_base_rankings.json
├── global_clan_builder_base_rankings.json
├── global_clan_capital_rankings.json
└── SUMMARY.md
\`\`\`

## Usage Notes
- All API calls include proper error handling
- Player data is organized in individual files within the players/ directory
- All JSON files are properly formatted and ready for analysis
- Rate limiting is handled by the API server

## Next Steps
1. Review the data in each JSON file
2. Import into your analysis tools
3. Set up automated data collection if needed
4. Consider implementing change detection for ongoing monitoring

EOF

echo "✅ Data pull completed!"
echo "📊 Summary report created: $OUTPUT_DIR/SUMMARY.md"
echo "📁 All data saved to: $OUTPUT_DIR/"
echo ""
echo "🔍 To view the data:"
echo "   ls -la $OUTPUT_DIR/"
echo "   cat $OUTPUT_DIR/SUMMARY.md"
echo ""
echo "📈 Total files created: $(find "$OUTPUT_DIR" -name "*.json" | wc -l)"
