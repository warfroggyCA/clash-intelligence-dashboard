# War Planning Optimization

## Two-Pass War Planning Strategy

### Problem
Current war planning likely does a full enriched retrieval for all opponents, which:
- Hits rate limits unnecessarily
- Wastes API calls on players who won't be selected
- Slows down the planning process

### Solution: Two-Pass Approach

#### Pass 1: Lightweight Player List
- **Purpose**: Get basic opponent roster for leader selection
- **Data**: Minimal fields only (tag, name, TH level, basic stats)
- **Rate Limit Impact**: Minimal - single clan roster call
- **UI**: Simple list for leader to review and select participants

#### Pass 2: Enriched Retrieval
- **Purpose**: Get full detailed data for selected opponents only
- **Data**: Complete player profiles, war history, attack patterns, etc.
- **Rate Limit Impact**: Targeted - only for selected players
- **UI**: Detailed war planning interface with full opponent analysis

### Implementation Plan

#### Phase 1: Lightweight Endpoint
```typescript
// New endpoint: /api/v2/war-planning/opponents
GET /api/v2/war-planning/opponents?clanTag=#TAG
Response: {
  opponents: [
    {
      tag: "#ABC123",
      name: "PlayerName", 
      thLevel: 15,
      trophies: 5000,
      warStars: 100,
      // Minimal fields only
    }
  ]
}
```

#### Phase 2: Selection Interface
- Leader reviews opponent list
- Selects participating opponents
- Submits selection to backend

#### Phase 3: Enriched Retrieval
```typescript
// Enhanced endpoint: /api/v2/war-planning/selected
POST /api/v2/war-planning/selected
Body: { selectedTags: ["#ABC123", "#DEF456"] }
Response: {
  opponents: [
    {
      // CORE PLAYER DATA
      tag: "#ABC123",
      name: "PlayerName",
      thLevel: 15,
      trophies: 5000,
      warStars: 100,
      attackWins: 500,
      defenseWins: 200,
      
      // DETAILED WAR HISTORY
      warHistory: {
        last30Days: [...],
        attackSuccessRate: 0.85,
        defenseSuccessRate: 0.72,
        averageStars: 2.3,
        favoriteAttacks: ["Dragons", "LavaLoon"],
        warFrequency: "Daily"
      },
      
      // ATTACK PATTERNS & STRATEGIES
      attackPatterns: {
        preferredArmyComps: [...],
        attackTiming: "First 2 hours",
        targetSelection: "TH level +1",
        backupStrategies: [...],
        recentInnovations: [...]
      },
      
      // BASE ANALYSIS
      baseLayouts: {
        currentLayout: {...},
        layoutHistory: [...],
        weakSpots: [...],
        defensiveStrengths: [...],
        trapPlacements: [...],
        ccTroops: [...]
      },
      
      // SOCIAL & BEHAVIORAL
      activityPatterns: {
        onlineHours: [...],
        warParticipation: 0.95,
        donationPatterns: {...},
        clanChatActivity: "High",
        leadershipRole: "Elder"
      },
      
      // THREAT ASSESSMENT
      threatLevel: "High",
      priorityTarget: true,
      recommendedCounters: [...],
      attackDifficulty: "Hard",
      defenseStrength: "Very Strong",
      
      // RECENT PERFORMANCE
      recentAttacks: [...],
      recentDefenses: [...],
      performanceTrends: {...},
      seasonalStats: {...},
      
      // STRATEGIC INSIGHTS
      vulnerabilities: [...],
      strengths: [...],
      counterStrategies: [...],
      warRole: "Anchor",
      targetPriority: 1
    }
  ]
}
```

### Benefits
1. **Rate Limit Efficiency**: Only fetch full data for selected players
2. **Faster Initial Load**: Quick opponent list for selection
3. **Better UX**: Leader can review and select before heavy data loading
4. **Scalable**: Works with large opponent clans
5. **Cost Effective**: Reduces unnecessary API calls
6. **Deep Intelligence**: Comprehensive analysis for selected targets only
7. **Strategic Advantage**: Detailed behavioral and tactical insights

### Data Sources for Enriched Analysis
- **Clash API**: Player stats, war history, base layouts
- **Historical Database**: Past war performances, attack patterns
- **Behavioral Analysis**: Activity patterns, donation history, chat activity
- **Performance Metrics**: Success rates, star averages, timing patterns
- **Strategic Intelligence**: Counter strategies, vulnerabilities, strengths

### Technical Considerations
- Cache lightweight opponent list for session
- Implement selection state management
- Add loading states for enriched retrieval
- Handle partial failures gracefully
- Consider pagination for very large opponent rosters

### Current Implementation Snapshot
- ✅ `/api/v2/war-planning/our-roster` — lightweight view of our lineup for selection
- ✅ `/api/v2/war-planning/opponents` — lightweight opponent roster
- ✅ `/api/v2/war-planning/our-selection` — stores and summarizes chosen attackers
- ✅ `/api/v2/war-planning/selected` — enriched opponent payload (placeholder analysis fields)
- ✅ `/api/v2/war-planning/matchup` — baseline team comparison & recommendations
- ✅ `/war/planning` UI — checkbox-driven workflow to select both rosters and run the matchup analyzer
- ✅ War plan persistence — leaders can save/load lineup selections per matchup
- ✅ Deterministic analysis pipeline — slot-by-slot deltas, confidence score, and recommendations stored with each plan
- ✅ Plan manager UI — reload saved plan, copy full payload (for LLM sharing), and preserve selections across reloads
- 🔜 Hook in deeper AI/analytics once richer data feeds are populated

### Future Enhancements
- Pre-filter opponents by TH level ranges
- Save selection preferences
- Batch operations for multiple wars
- Integration with existing war tracking system
