# WCI Implementation - Clean Simple Architecture Plan

**Date:** January 2025  
**Status:** 🚀 Starting Fresh  
**Principle:** SSOT = Supabase. Pull once, use everywhere. Simple Architecture only.

---

## 🎯 The Goal

**Implement Weekly Competitive Index (WCI) as the primary competitive metric**, replacing ACE score, using Simple Architecture principles.

**No looking back at old architecture. Everything fresh. Clean. Simple.**

---

## 📋 What We Want (From FEATURE_INVENTORY.md)

### Primary Outcome
- **WCI Score** (0-100) displayed prominently in roster table
- Weekly competitive performance tracking
- Historical WCI trends
- CP (Competitive Performance) and PS (Progression & Support) breakdowns

### Data We Need (All from Supabase)
- Weekly snapshots (Monday captures after tournament reset)
- Ranked battle trophies and league tier
- Attack/defense wins from ranked battles
- Hero levels (for progression tracking)
- Donations and capital contributions (for support metrics)
- Tournament attack counts (if available via API)

---

## 🏗️ Implementation Plan

### Phase 1: Database Schema

**Create WCI storage in Supabase**

```sql
-- WCI Scores Table
CREATE TABLE wci_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) NOT NULL,
  week_start DATE NOT NULL,  -- Tournament week start (Tuesday 5 AM UTC)
  week_end DATE NOT NULL,    -- Tournament week end (Monday 5 AM UTC)
  
  -- Competitive Performance (CP) Components
  tur DECIMAL(5,2),          -- Tournament Utilization Rate (0-100)
  tte DECIMAL(5,2),          -- Tournament Trophy Efficiency (0-100)
  lai DECIMAL(5,2),          -- League Advancement Index (0-100)
  drs DECIMAL(5,2),          -- Defense Resilience Score (0-100)
  cp_score DECIMAL(5,2),     -- Combined CP (0-100)
  
  -- Progression & Support (PS) Components
  pdr DECIMAL(5,2),          -- Progression Debt Reduction (0-100)
  donation_support DECIMAL(5,2), -- Donation & Resource Support (0-100)
  sbc DECIMAL(5,2),          -- Star Bonus Completion (0-100)
  ps_score DECIMAL(5,2),      -- Combined PS (0-100)
  
  -- Final Score
  wci_score DECIMAL(5,2) NOT NULL,  -- 0-100
  
  -- Metadata for calculations
  ranked_trophies_start INTEGER,
  ranked_trophies_end INTEGER,
  attacks_used INTEGER,
  attacks_allowed INTEGER,
  league_tier INTEGER,
  league_name TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(member_id, week_start)
);

-- Indexes for fast queries
CREATE INDEX idx_wci_week ON wci_scores(week_start, week_end);
CREATE INDEX idx_wci_score ON wci_scores(wci_score DESC);
CREATE INDEX idx_wci_member ON wci_scores(member_id, week_start DESC);
```

**Migration File:** `supabase/migrations/YYYYMMDD_create_wci_scores.sql`

---

### Phase 2: WCI Calculation Logic

**File:** `web-next/src/lib/metrics/wci.ts`

**Functions to implement:**

```typescript
// Core calculation functions
export function calculateTUR(attacksUsed: number, attacksAllowed: number): number;
export function calculateTTE(trophiesEarned: number, maxPotential: number): number;
export function calculateLAI(leagueTierStart: number, leagueTierEnd: number, promoted: boolean): number;
export function calculateDRS(defensiveTrophyGains: number, potentialLosses: number): number;

export function calculatePDR(rushPercentage: number, progressionVelocity: number): number;
export function calculateDonationSupport(donations: number, received: number, capitalContrib: number): number;
export function calculateSBC(starBonusCompletions: number, daysInWeek: number): number;

// Main orchestrator
export function calculateWCI(
  cpComponents: CPComponents,
  psComponents: PSComponents
): WCIScore;

// Batch calculation for roster
export function calculateWCIForRoster(
  members: Member[],
  weekStart: Date,
  weekEnd: Date
): WCIScore[];
```

**Data Sources (all from Supabase):**
- `member_snapshot_stats` - Weekly snapshots
- `members` - Member base data
- Calculate from snapshot deltas (this week vs last week)

**Challenges to research:**
- Do we have ranked battle attack counts in API?
- Can we track defensive trophy gains?
- How do we identify weekly tournament cycles?

---

### Phase 3: Ingestion Integration

**File:** `web-next/src/lib/ingestion/staged-pipeline.ts`

**When to calculate:**
- After Monday snapshot capture (tournament reset)
- Run as post-processing step
- Store results in `wci_scores` table

**Integration point:**
```typescript
// In staged-pipeline.ts, after snapshot persistence
async function calculateWeeklyMetrics(snapshotId: string, weekStart: Date) {
  // Fetch member snapshots for this week
  // Calculate WCI for each member
  // Store in wci_scores table
}
```

**Run frequency:**
- Weekly, after tournament reset (Monday 5 AM UTC)
- Part of daily ingestion pipeline on Mondays

---

### Phase 4: API Endpoint Enhancement

**File:** `web-next/src/app/api/v2/roster/route.ts`

**Add WCI to roster response:**

```typescript
interface RosterMember {
  // ... existing fields
  wci?: {
    score: number;           // Current week WCI (0-100)
    rank: number;            // Rank in clan this week
    cp_score: number;         // Competitive Performance
    ps_score: number;         // Progression & Support
    trend: 'up' | 'down' | 'stable';  // vs last week
    last_week_score?: number;
  };
}
```

**Query logic:**
```typescript
// Fetch current week WCI scores from Supabase
const currentWeekStart = getCurrentTournamentWeekStart();
const wciScores = await supabase
  .from('wci_scores')
  .select('*')
  .eq('week_start', currentWeekStart);

// Join with member data
// Add to roster response
```

---

### Phase 5: UI Integration - Simple Roster

**File:** `web-next/src/app/simple-roster/RosterPage.tsx`

**Add WCI column:**
1. Add "WCI" column header (sortable)
2. Display WCI score (0-100) with color coding:
   - Green: 80-100 (High)
   - Yellow: 50-79 (Medium)
   - Red: 0-49 (Low)
3. Show trend indicator (↑ ↓ →)
4. Tooltip on hover showing CP/PS breakdown

**Color coding:**
```typescript
const getWCIColor = (score: number) => {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
};
```

**Default sort:**
- WCI score descending (top performers first)

---

### Phase 6: Player Profile Integration

**File:** `web-next/src/app/player/[tag]/PlayerProfileClient.tsx`

**Add WCI section:**
1. Current week WCI score (large display)
2. CP vs PS breakdown (visual bars)
3. Historical WCI chart (last 4-8 weeks)
4. Trend indicator

**Chart library:**
- Use simple line chart (or built-in Next.js chart)
- Show weekly WCI scores over time
- Highlight current week

---

## 🔍 Research & Open Questions

### API Data Availability
- [ ] Does CoC API provide ranked battle trophy deltas?
- [ ] Can we track defensive trophy gains?
- [ ] How do we get weekly tournament attack counts?
- [ ] What data exists for Star Bonus completion?

**Action:** Check `COC_API_MASTER_INDEX.md` and verify what's actually available.

### Calculation Assumptions
- [ ] League tier attack limits (6-30 based on tier) - need mapping
- [ ] Weekly cycle timing (Tuesday 5 AM - Monday 5 AM UTC)
- [ ] How to handle partial weeks (new members)

---

## 📊 Success Criteria

### Phase 1 Complete When:
- ✅ `wci_scores` table created in Supabase
- ✅ Migration applied successfully
- ✅ Indexes created for performance

### Phase 2 Complete When:
- ✅ WCI calculation functions implemented
- ✅ Unit tests written and passing
- ✅ Edge cases handled (missing data, partial weeks)

### Phase 3 Complete When:
- ✅ WCI calculation runs automatically on Monday
- ✅ Scores stored in database
- ✅ Integration doesn't break existing pipeline

### Phase 4 Complete When:
- ✅ WCI data included in `/api/v2/roster` response
- ✅ Query performance acceptable (<300ms)

### Phase 5 Complete When:
- ✅ WCI column displays in roster table
- ✅ Sorting works correctly
- ✅ Color coding accurate
- ✅ Tooltips show breakdown

### Phase 6 Complete When:
- ✅ WCI displays on player profiles
- ✅ Historical chart shows trends
- ✅ Visual breakdown clear

---

## 🚀 Immediate Next Steps

1. **Research API Data** (Today)
   - Review `COC_API_MASTER_INDEX.md`
   - Verify ranked battle data availability
   - Document what we can actually calculate

2. **Design Database Schema** (Today)
   - Finalize `wci_scores` table structure
   - Create migration file
   - Test migration locally

3. **Start Calculation Logic** (This Week)
   - Implement basic WCI calculation
   - Start with components we have data for
   - Add placeholders for missing data

4. **Integrate into Pipeline** (Next Week)
   - Add WCI calculation to ingestion
   - Test Monday calculation
   - Verify data persistence

5. **Add to UI** (Following Week)
   - Add WCI column to roster
   - Update API endpoint
   - Test display and sorting

---

## 🧹 Cleanup Before Starting

**Before implementing WCI, clean up:**

1. Move obsolete ACE score references to deprecated
2. Remove complex dashboard code (archive)
3. Verify Simple Architecture routes are stable
4. Document that WCI replaces ACE

**Don't let old code confuse the implementation!**

---

## 📚 Reference Documents

- `FEATURE_INVENTORY.md` - What we want (outcomes)
- `ACTIVITY_METRICS_AND_REPORTING_IDEAS.md` - Original WCI proposal
- `COC_API_MASTER_INDEX.md` - API data sources
- `SIMPLE_ARCHITECTURE_CHANGELOG.md` - Simple Architecture principles

---

**Status:** Ready to begin Phase 1  
**Next Action:** Research API data availability
