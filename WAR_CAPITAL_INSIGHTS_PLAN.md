# War Performance, Capital Analytics & Smart Insights Consolidation Plan

**Created:** November 13, 2025  
**Status:** In Progress

---

## 🎯 Overview

This document outlines the implementation plan for three major feature areas:
1. **War Performance Intelligence Engine** - Comprehensive war analytics
2. **Smart Insights Consolidation** - Unified insights system
3. **Capital Analytics Enhancements** - Enhanced capital raid tracking

---

## 1. War Performance Intelligence Engine ⭐⭐

### Current State
- ✅ Database tables exist (`clan_wars`, `clan_war_members`, `clan_war_attacks`)
- ✅ Basic war metrics calculations (`war-metrics.ts`)
- ✅ API endpoints exist (`/api/clan/[tag]/warlog`, `/api/clan/[tag]/currentwar`)
- ❌ No ingestion pipeline to populate war data
- ❌ No comprehensive analytics dashboard

### Implementation Plan

#### Phase 1: War Data Ingestion Pipeline
**Files to create:**
- `web-next/src/lib/ingestion/war-ingestion.ts` - War log ingestion logic
- `web-next/src/app/api/cron/war-ingestion/route.ts` - Cron endpoint for war ingestion

**Features:**
- Fetch `/clans/{tag}/warlog` (limit 10-20 most recent wars)
- Fetch `/clans/{tag}/currentwar` when active
- Store in `clan_wars`, `clan_war_clans`, `clan_war_members`, `clan_war_attacks` tables
- Idempotent writes (check for existing wars by battle_start)
- Run daily (or more frequently during active wars)

#### Phase 2: War Performance Intelligence Engine
**Files to create:**
- `web-next/src/lib/war-intelligence/engine.ts` - Core intelligence engine
- `web-next/src/lib/war-intelligence/metrics.ts` - Advanced metrics calculations

**Metrics to calculate:**
1. **Attack Efficiency Index (AEI)**
   - Stars per attack average
   - Destruction per attack average
   - Cleanup efficiency (attacks on lower THs)
   - Clutch factor (late-war deciding attacks)

2. **Contribution Consistency Score**
   - War participation rate (attacks used / attacks available)
   - Consistency across multiple wars
   - Streak tracking (consecutive wars with attacks)

3. **Defensive Hold Rate**
   - Defenses survived vs. attacks received
   - Average destruction allowed
   - Base strength vs. opponent strength

4. **Strategy Failure Detection**
   - Failed attacks (0-1 stars on equal/higher TH)
   - Attack timing analysis (too early vs. too late)
   - Target selection quality

#### Phase 3: War Analytics Dashboard
**Files to create:**
- `web-next/src/components/war/WarAnalyticsDashboard.tsx` - Main dashboard component
- `web-next/src/components/war/WarPerformanceChart.tsx` - Performance trends
- `web-next/src/components/war/MemberWarStats.tsx` - Individual member stats
- `web-next/src/app/war-analytics/page.tsx` - War analytics page

**Features:**
- Recent war performance overview
- Member war performance leaderboard
- Attack efficiency trends
- Win/loss analysis
- Opponent strength analysis
- Member coaching recommendations

---

## 2. Smart Insights Consolidation

### Current State
- ✅ Multiple AI endpoints (`/api/ai-coaching/*`, `/api/ai-summary/*`, `/api/ai/dna-cache`)
- ✅ Smart Insights Engine exists (`smart-insights.ts`)
- ✅ Unified payload structure (`SmartInsightsPayload`)
- ❌ Legacy endpoints still active
- ❌ Scattered "AI" branding
- ❌ No prominent dashboard integration

### Implementation Plan

#### Phase 1: Endpoint Consolidation
**Actions:**
- Deprecate `/api/ai-coaching/generate` → redirect to `/api/insights`
- Deprecate `/api/ai-summary/generate` → redirect to `/api/insights`
- Deprecate `/api/ai/dna-cache` → redirect to `/api/insights`
- Update all frontend calls to use unified `/api/insights` endpoint

**Files to modify:**
- `web-next/src/app/api/ai-coaching/generate/route.ts` - Add deprecation notice
- `web-next/src/app/api/ai-summary/generate/route.ts` - Add deprecation notice
- `web-next/src/app/api/ai/dna-cache/route.ts` - Add deprecation notice
- `web-next/src/components/CoachingInsights.tsx` - Update to use `/api/insights`
- `web-next/src/components/PlayerDNADashboard.tsx` - Update to use `/api/insights`

#### Phase 2: Dashboard Integration
**Files to create/modify:**
- `web-next/src/components/insights/TodaysHeadlines.tsx` - Prominent headlines component
- `web-next/src/app/simple-roster/RosterPage.tsx` - Add headlines section

**Features:**
- Prominent "Today's Headlines" section at top of dashboard
- Top 3-5 actionable insights cards
- "View all insights" link to detailed view
- Stale insights badge when data is old

#### Phase 3: Branding Cleanup
**Actions:**
- Remove "AI" from user-facing text (already started)
- Rename "AI Coaching" → "Coaching Insights"
- Rename "AI Summary" → "Daily Summary"
- Update all component names and labels

---

## 3. Capital Analytics Enhancements

### Current State
- ✅ Database tables exist (`capital_raid_seasons`, `capital_raid_weekends`, `capital_raid_participants`)
- ✅ Basic capital data in roster summary
- ❌ No ingestion pipeline
- ❌ Limited analytics
- ❌ No visualizations

### Implementation Plan

#### Phase 1: Capital Raid Ingestion Pipeline
**Files to create:**
- `web-next/src/lib/ingestion/capital-ingestion.ts` - Capital raid ingestion logic
- `web-next/src/app/api/cron/capital-ingestion/route.ts` - Cron endpoint

**Features:**
- Fetch `/clans/{tag}/capitalraidseasons` weekly
- Capture current weekend every 15 minutes during raids
- Store in `capital_raid_seasons`, `capital_raid_weekends`, `capital_raid_participants`
- Track participant attack counts, loot, bonus attacks

#### Phase 2: Capital Analytics Engine
**Files to create:**
- `web-next/src/lib/capital-analytics/engine.ts` - Analytics calculations
- `web-next/src/lib/capital-analytics/metrics.ts` - Metric definitions

**Metrics to calculate:**
1. **Loot per Attack**
   - Average loot per attack
   - Efficiency compared to clan average
   - Trend over time

2. **Carry Score**
   - Bonus attacks earned (indicates strong performance)
   - Attacks used vs. available
   - Contribution to total clan loot

3. **Participation Tracking**
   - Weekend participation rate
   - Consistency across weekends
   - Missed weekends detection

4. **District Performance**
   - Which districts attacked most
   - Success rate by district
   - Loot efficiency by district type

5. **ROI Analysis**
   - Capital gold contributed vs. loot gained
   - Net contribution score
   - Efficiency ranking

#### Phase 3: Capital Analytics Dashboard
**Files to create:**
- `web-next/src/components/capital/CapitalAnalyticsDashboard.tsx` - Main dashboard
- `web-next/src/components/capital/CapitalParticipationChart.tsx` - Participation trends
- `web-next/src/components/capital/CapitalLootChart.tsx` - Loot efficiency
- `web-next/src/components/capital/DistrictHeatmap.tsx` - District performance
- `web-next/src/app/capital-analytics/page.tsx` - Capital analytics page

**Features:**
- Weekend performance overview
- Member participation leaderboard
- Loot efficiency analysis
- District performance heatmap
- ROI analysis
- Participation trends

---

## Implementation Order

### Week 1: Foundation
1. ✅ War ingestion pipeline
2. ✅ Capital ingestion pipeline
3. ✅ Basic data validation

### Week 2: Intelligence Engines
1. ✅ War Performance Intelligence Engine
2. ✅ Capital Analytics Engine
3. ✅ API endpoints for analytics

### Week 3: UI & Consolidation
1. ✅ War Analytics Dashboard
2. ✅ Capital Analytics Dashboard
3. ✅ Smart Insights consolidation
4. ✅ Dashboard integration

### Week 4: Polish & Testing
1. ✅ Testing & bug fixes
2. ✅ Performance optimization
3. ✅ Documentation

---

## Success Criteria

### War Performance Intelligence Engine
- [ ] War data ingested daily
- [ ] All 4 core metrics calculated accurately
- [ ] Dashboard shows comprehensive war analytics
- [ ] Member coaching recommendations generated

### Smart Insights Consolidation
- [ ] All legacy endpoints deprecated
- [ ] Unified `/api/insights` endpoint used everywhere
- [ ] "Today's Headlines" prominently displayed
- [ ] No "AI" branding in user-facing text

### Capital Analytics Enhancements
- [ ] Capital data ingested weekly + during raids
- [ ] All 5 metrics calculated accurately
- [ ] Dashboard shows comprehensive capital analytics
- [ ] District heatmap visualization working

---

## Notes

- War ingestion should run daily (or more frequently during active wars)
- Capital ingestion should run weekly + every 15 minutes during active raid weekends
- All ingestion should be idempotent (check for existing data before inserting)
- Analytics calculations should be cached to avoid expensive recomputation
- Dashboard components should use SWR for data fetching with appropriate cache TTLs

