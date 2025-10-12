# Activity Tracking Improvements - Session Summary

**Date:** January 26, 2025  
**Context:** Ranked League Badge Display Fix + Activity Tracking Enhancement

---

## 🎯 What Was Accomplished

### 1. Ranked League Badge Display - FIXED ✅

**Problem:** Ranked league badges were not matching in-game roster display.

**Root Cause Identified:**
- TypeScript type `CoCClanMembersResp` was missing `leagueTier` field
- Ingestion logic prioritized clan members API over player detail API
- No check for actual participation (players with league assignment but no battles)

**Solution Implemented:**
1. **Updated Type Definitions:**
   - Added `leagueTier` to `CoCClanMembersResp` type in `/app/web-next/src/lib/coc.ts`
   - Added `leagueTier` to `MemberSummary` interface in `/app/web-next/src/lib/full-snapshot.ts`
   - Added `rankedTrophies` tracking to frontend types

2. **Fixed Data Ingestion Priority** (`/app/web-next/src/lib/ingestion/persist-roster.ts`):
   ```typescript
   // Changed from: summary.leagueTier ?? detail?.leagueTier (WRONG)
   // Changed to:   detail?.leagueTier ?? summary.leagueTier (CORRECT)
   ```
   - Player detail API (`/players/{tag}`) provides accurate ranked league data
   - Clan members API (`/clans/{tag}/members`) has stale data

3. **Badge Display Logic** (`/app/web-next/src/app/simple-roster/page.tsx`):
   ```typescript
   rankedLeagueName: (
     m.rankedLeagueId && 
     m.rankedLeagueId !== 105000000 &&  // Not Unranked
     m.trophies > 0                      // Has actually participated
   ) ? m.rankedLeagueName : null
   ```

4. **Fixed League Tier Rankings:**
   - Corrected hierarchy: Witch League (6) > Valkyrie League (5)

5. **UI Improvements:**
   - League badges enlarged to 48px (matching TH badges)
   - Tier numbers now white text with drop shadow (removed black background)
   - Theme toggle removed - dark theme is the only theme
   - Columns reordered: Player > Role > TH > League (icon columns grouped)
   - Clan name fixed in header (was showing tag instead of name)

**Known Limitation:**
- CoC API doesn't expose "enrollment" status
- Players enrolled but not yet battled show as "Unranked" (they have `leagueTier` but `trophies: 0`)
- Current logic balances accuracy vs false positives

---

## 📚 API Documentation Referenced

User provided comprehensive CoC API documentation package:

### File 1: `COC_API_MASTER_INDEX.md` (15 KB)
- **Repository:** `warfroggyCA/clash-intelligence-dashboard`
- **URL:** https://github.com/warfroggyCA/clash-intelligence-dashboard/blob/main/COC_API_MASTER_INDEX.md
- **Contents:** Overview of all 36 API endpoints, complete data coverage summary

### File 2: `COC_API_QUICK_REFERENCE.md` (18 KB)
- **URL:** https://github.com/warfroggyCA/clash-intelligence-dashboard/blob/main/COC_API_QUICK_REFERENCE.md
- **Contents:** Quick lookup guide with copy-paste commands, all field names by category
- **Key Sections:**
  - Clan Data (50+ fields)
  - Player Data (100+ fields)
  - War Data (40+ fields)
  - Capital Raid Data (30+ fields)
  - Achievements (60+)
  - Leagues (29 trophy, 19 war, 31 builder, 23 capital)

### File 3: `COC_API_COMPLETE_REFERENCE.json` (36 KB)
- **URL:** https://github.com/warfroggyCA/clash-intelligence-dashboard/blob/main/COC_API_COMPLETE_REFERENCE.json
- **Contents:** Complete technical documentation for all endpoints

### File 4: `COC_API_REAL_DATA_EXAMPLES.json` (332 KB)
- **URL:** https://github.com/warfroggyCA/clash-intelligence-dashboard/blob/main/COC_API_REAL_DATA_EXAMPLES.json
- **Contents:** Real API responses from Criterium clan (#2PR8R8V8P)

**Package Stats:**
- 11,479 lines total
- 440 KB of documentation
- 36 API endpoints fully documented
- Real data from user's actual clan

---

## 🔍 Current Activity Tracking Analysis

### Current Implementation Location
**File:** `/app/web-next/src/lib/business/calculations.ts`

### Current Activity Calculation Method

**Function:** `calculateActivityScore(member: Member): ActivityEvidence`

**Scoring System (0-100 points):**

1. **Real-time Activity (0-50 points)**
   - Uses `calculateRealTimeActivity()` based on donations
   - 500+ donations = 50 points ("Very Active")
   - 100+ donations = 40 points ("Active")
   - 10+ donations = 30 points ("Moderate")
   - 0-10 donations = 0 points ("Inactive")

2. **Trophy Activity (0-25 points)** - PLACEHOLDER
   - Currently not implemented (needs historical data)
   - Would track trophy changes over time

3. **Town Hall Progress (0-20 points)**
   - TH14+ = 20 points
   - TH11-13 = 15 points
   - TH8-10 = 10 points
   - TH1-7 = 5 points

4. **Hero Activity (0-15 points)**
   - Based on hero level progress vs max for TH
   - >50% avg progress = 15 points
   - Has heroes = 5 points

5. **Clan Role (0-10 points)**
   - Leader/Co-Leader = 10 points
   - Elder = 5 points
   - Member = 0 points

**Activity Level Thresholds:**
- 80+ points = "Very Active"
- 60-79 points = "Active"
- 40-59 points = "Moderate"
- 20-39 points = "Low"
- 0-19 points = "Inactive"

### Current Limitations

1. **Donations-Heavy Bias:**
   - 50% of score comes from donations alone
   - Misses active players who attack/war but don't donate

2. **No Real-Time Indicators:**
   - No ranked battle participation tracking
   - No war attack tracking
   - No clan games participation
   - No capital raid participation

3. **Missing Historical Data:**
   - Trophy change tracking not implemented
   - Can't track progression over time

4. **Static Indicators Only:**
   - TH level and hero levels are static
   - Don't reflect current engagement

---

## 💡 Proposed Activity Tracking Improvements

### New Data Points Available from CoC API

Based on API documentation review, we can leverage:

#### 1. **Ranked Battle Participation** (NEW!)
**Endpoint:** `/players/{tag}`
**Fields:**
- `leagueTier.id` - League assignment
- `leagueTier.name` - League name
- `trophies` - Current ranked trophies
- `bestTrophies` - Best trophy count

**Activity Indicators:**
- `trophies > 0` = Currently participating in ranked battles (definitive activity)
- `leagueTier.id !== 105000000` = Has league assignment
- Trophy changes over time = Active battle engagement

#### 2. **War Participation**
**Endpoint:** `/clans/{tag}/currentwar`
**Fields:**
- `clan.members[].attacks[]` - Attack history in current war
- `clan.members[].mapPosition` - War roster position

**Activity Indicators:**
- In current war roster = Active
- Used attacks = High activity
- Attack stars/destruction = Engagement quality

#### 3. **War History**
**Endpoint:** `/clans/{tag}/warlog`
**Fields:**
- Historical war participation
- Win/loss record
- Attack performance over time

**Activity Indicators:**
- Wars participated in last 7/14/30 days
- Attack usage rate
- Performance trends

#### 4. **Capital Raids**
**Endpoint:** `/clans/{tag}/capitalraidseasons`
**Fields:**
- `members[].attacks` - Attacks used
- `members[].attackLimit` - Base limit (5)
- `members[].bonusAttackLimit` - Bonus attacks earned
- `members[].capitalResourcesLooted` - Gold looted

**Activity Indicators:**
- Participated in last raid weekend = Active
- Used all attacks = High engagement
- Bonus attacks earned = Very active

#### 5. **Clan Games** (via Achievements)
**Endpoint:** `/players/{tag}`
**Fields:**
- `achievements[]` - Find "Games Champion" achievement
- `.value` - Points scored
- `.target` - Tier target

**Activity Indicators:**
- Recent achievement progress = Active
- Hit max tier = Very active

#### 6. **Donations** (Already Tracked)
**Current implementation uses this well**
- `donations` - Given
- `donationsReceived` - Received
- Ratio and absolute values

### Proposed New Scoring System

**Total: 0-100 points**

#### Tier 1: Definitive Real-Time Indicators (0-60 points)

1. **Ranked Battle Participation (0-20 points)**
   - Has trophies > 0: **20 points** (definitive participation)
   - Has league but trophies = 0: **5 points** (enrolled, not active)
   - No league: **0 points**

2. **War Participation (0-20 points)**
   - In current war + used both attacks: **20 points**
   - In current war + used 1 attack: **15 points**
   - In current war + no attacks yet: **10 points**
   - Not in current war but in last 3 wars: **5 points**
   - Not in any recent wars: **0 points**

3. **Donations (0-15 points)**
   - 500+ donations: **15 points**
   - 200-499: **12 points**
   - 100-199: **10 points**
   - 50-99: **7 points**
   - 10-49: **5 points**
   - 1-9: **2 points**
   - 0: **0 points**

4. **Capital Raid Participation (0-5 points)**
   - Participated in last raid + used all attacks: **5 points**
   - Participated in last raid + partial attacks: **3 points**
   - Did not participate: **0 points**

#### Tier 2: Supporting Indicators (0-40 points)

5. **Trophy Activity (0-10 points)**
   - Trophy gain this season: **10 points**
   - Stable (±50): **5 points**
   - Loss > 50: **2 points**
   - No data: **0 points**

6. **Clan Games (0-10 points)**
   - Max tier achieved: **10 points**
   - Partial participation: **5 points**
   - No participation: **0 points**

7. **Hero Development (0-10 points)**
   - Active upgrades (high progress): **10 points**
   - Moderate progress: **5 points**
   - Low/no progress: **2 points**

8. **Clan Role (0-10 points)**
   - Leader/Co-Leader: **10 points**
   - Elder: **5 points**
   - Member: **0 points**

### New Activity Level Classification

**Based on 0-100 point scale:**

- **85-100 points:** "Very Active" 
  - Participating in ranked battles, wars, raids, and donating heavily
  - Multiple concurrent activity streams

- **65-84 points:** "Active"
  - Participating in 2-3 activity streams regularly
  - Consistent engagement

- **45-64 points:** "Moderate"
  - Participating in 1-2 activities
  - Sporadic engagement

- **25-44 points:** "Low"
  - Minimal participation
  - Infrequent engagement

- **0-24 points:** "Inactive"
  - Little to no recent activity
  - May be taking break or left game

### Confidence Levels

**Definitive (3+ indicators):**
- Has ranked trophies > 0
- In current war with attacks
- Recent donations > 100

**High (2 indicators):**
- Any 2 of: ranked participation, war, donations, raids

**Medium (1 indicator):**
- Single activity stream detected

**Low (0 indicators):**
- Only static data (TH level, role, hero levels)

---

## 🚀 Implementation Plan

### Phase 1: Data Collection Enhancement
**Files to modify:**
1. `/app/web-next/src/lib/ingestion/persist-roster.ts`
   - Already captures `rankedTrophies` from player detail API
   - Add war participation tracking
   - Add capital raid participation tracking

2. `/app/web-next/src/types/index.ts`
   - Extend `Member` type with new fields:
     ```typescript
     interface Member {
       // Existing fields...
       rankedTrophies?: number;
       inCurrentWar?: boolean;
       warAttacksUsed?: number;
       lastCapitalRaidAttacks?: number;
       clanGamesPoints?: number;
     }
     ```

### Phase 2: Activity Calculation Update
**Files to modify:**
1. `/app/web-next/src/lib/business/calculations.ts`
   - Update `calculateActivityScore()` with new logic
   - Update `calculateRealTimeActivity()` to use multiple indicators
   - Add helper functions for each activity type

### Phase 3: Testing
- Test with real clan data (#2PR8R8V8P)
- Verify activity scores match expected player engagement
- Compare with current donation-based scoring

### Phase 4: UI Updates (if needed)
- Activity column already exists in simple-roster
- May want to add activity breakdown/tooltip showing score components

---

## 📊 Expected Impact

### Before (Donation-Heavy):
```
Player A: 600 donations, no wars, no ranked = "Very Active" (50 pts)
Player B: 50 donations, all wars, ranked battles = "Inactive" (30 pts)
```

### After (Multi-Indicator):
```
Player A: 600 donations, no wars, no ranked = "Active" (15 + 0 + 0 = 65 pts)
Player B: 50 donations, all wars, ranked battles = "Very Active" (20 + 20 + 7 = 87 pts)
```

More accurate reflection of actual game engagement across all activities!

---

## 🔗 Key Files Modified So Far

1. `/app/web-next/src/lib/coc.ts` - Added `leagueTier` to types
2. `/app/web-next/src/lib/full-snapshot.ts` - Added `leagueTier` capture
3. `/app/web-next/src/lib/ingestion/persist-roster.ts` - Fixed data priority
4. `/app/web-next/src/app/simple-roster/page.tsx` - Badge display logic + UI improvements
5. `/app/web-next/src/components/ui/LeagueBadge.tsx` - Larger badges, white numbers
6. `/app/web-next/src/components/layout/DashboardLayout.tsx` - Removed theme toggle, fixed clan name

---

## 🎯 Next Steps for Forked Conversation

1. **Review this document** to understand context
2. **Reference API docs** at GitHub links above for any field questions
3. **Implement Phase 1:** Enhance data collection in ingestion
4. **Implement Phase 2:** Update activity calculations
5. **Test with real data:** Verify accuracy improvements
6. **Deploy and validate:** Check against in-game observations

---

## 🔑 Key Insights

1. **Player Detail API is source of truth** for ranked league data
2. **`trophies > 0` indicates actual participation** in ranked battles
3. **Multi-indicator approach** provides more accurate activity assessment
4. **CoC API provides rich activity data** beyond just donations
5. **Activity tracking should use definitive real-time indicators** over static base progress

---

**Session Context Preserved:** This document contains everything needed to continue the activity tracking improvements work in a new conversation fork.
