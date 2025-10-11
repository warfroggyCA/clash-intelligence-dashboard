# 🐛 CRITICAL BUG REPORT: Player Profile Pages Broken & Navigation Crash

**Date:** October 11, 2025  
**Severity:** CRITICAL - Production is completely broken  
**Impact:** All player profile links non-functional + crash on browser back button  
**Status:** ⚠️ ACTIVE - Needs deep investigation

---

## 🔴 **SYMPTOMS (What the User Sees)**

### Symptom 1: Wrong Player Data
- **Action:** Click any player name from roster (e.g., "andrew" with tag `#UU9GJ9QQ`)
- **Expected:** Navigate to andrew's profile page with his real data
- **Actual:** Page loads with mock data showing `Player UU9G` (first 4 chars of tag)
- **Worse:** Before our emergency fix, it ALWAYS showed "DoubleD" for ALL players

### Symptom 2: Navigation Crash
- **Action:** Use browser back button from player profile to return to dashboard
- **Expected:** Dashboard loads normally
- **Actual:** React crash with "Maximum update depth exceeded" error
- **Impact:** User cannot navigate back - completely stuck

---

## 🔍 **ROOT CAUSE ANALYSIS**

### Problem 1: Player Data Not Loading from Database

**File:** `web-next/src/lib/player-profile.ts`

**The Flow:**
```typescript
// Line 119: Entry point
export async function fetchPlayerProfile(tag: string): Promise<PlayerProfileData> {
  const normalizedWithHash = normalizeTag(tag);
  const normalized = normalizePlayerTag(tag);

  try {
    // Line 124: Try to load from database
    const profile = await buildProfileFromSnapshots(normalizedWithHash);
    if (profile) {
      return profile;  // ❌ This never succeeds - always returns null
    }
  } catch (error) {
    console.warn('[PlayerProfile] Failed to build player profile from snapshots', error);
  }

  // Line 132: Falls back to mock data
  return buildMockProfile(normalized);  // ⚠️ THIS IS WHAT'S HAPPENING
}
```

**The Failure Point:**
```typescript
// Line 135-160: buildProfileFromSnapshots
async function buildProfileFromSnapshots(playerTagWithHash: string): Promise<PlayerProfileData | null> {
  // Load recent snapshots from clan_snapshots table
  const snapshots = await loadRecentFullSnapshots(clanTag, 2);
  
  // Try to find player in snapshot
  const member = dailySnapshot.members.find((m) => normalizeTag(m.tag) === normalizedPlayerTag);
  const playerDetail = latestSnapshot.playerDetails?.[normalizedPlayerTag];

  if (!member || !playerDetail) {
    console.log(`[PlayerProfile] Player not found in snapshot...`);
    return null;  // ❌ ALWAYS RETURNS NULL - WHY?
  }
  
  // ... rest of profile building (never reached)
}
```

**Why It's Failing (HYPOTHESIS):**

One or more of these is true:
1. ❌ `loadRecentFullSnapshots()` returns empty array (no snapshots found)
2. ❌ Snapshots exist but don't contain `playerDetails` field
3. ❌ Player IS in `members` array but NOT in `playerDetails` object
4. ❌ Tag normalization mismatch (e.g., `#UU9GJ9QQ` vs `UU9GJ9QQ`)

**Evidence:**
- ✅ Player API `/api/v2/roster` DOES return andrew with tag `#UU9GJ9QQ` and TH14
- ✅ Recent ingestion (Oct 9, 2025) was successful
- ❌ But player profile page can't find the player in snapshots
- ❌ Falls back to mock data instead

**The Emergency Fix We Applied:**
```typescript
// Line 601: buildMockProfile (BEFORE)
function buildMockProfile(normalized: string): PlayerProfileData {
  return {
    summary: {
      name: 'DoubleD',  // ❌ HARDCODED - always showed DoubleD!
      tag: `#${normalized}`,
      // ...
    }
  }
}

// Line 602: buildMockProfile (AFTER)
function buildMockProfile(normalized: string): PlayerProfileData {
  const mockName = `Player ${normalized.slice(0, 4).toUpperCase()}`;  // ✅ Dynamic
  return {
    summary: {
      name: mockName,  // ✅ Now shows "Player UU9G" instead of "DoubleD"
      // ...
    }
  }
}
```

**This doesn't fix the real issue** - it just makes it OBVIOUS when mock data is being used!

---

### Problem 2: Navigation Crash on Browser Back

**File:** Multiple files involved (RosterSummary, dashboard store, React router)

**The Crash:**
```
Error: Maximum update depth exceeded
Component: RosterSummaryInner
```

**What We've Already Fixed:**
1. ✅ `RosterSummary.tsx` - Stopped subscribing to entire `roster` object (line 91)
2. ✅ `RosterTable.tsx` - Added shallow comparison and selective subscriptions
3. ✅ `dashboard-store.ts` - Added `isRefreshingData` guard to prevent recursive calls
4. ✅ Player API route - Added `revalidate = 0` to prevent caching
5. ✅ Player PAGE route - Added `revalidate = 0` + `dynamic = 'force-dynamic'`

**But it's STILL crashing** when navigating back from player page!

**Why?**
The infinite loop fix works for normal navigation, but there's something specific about:
- Browser back button navigation
- Coming FROM player profile page
- Returning TO dashboard

**Hypothesis:** The player page might be setting some state or cache that triggers a re-render loop when navigating back.

---

## 🗂️ **FILES INVOLVED**

### Critical Files (Need Deep Investigation):
1. **`web-next/src/lib/player-profile.ts`** (Lines 119-261)
   - `fetchPlayerProfile()` - Entry point
   - `buildProfileFromSnapshots()` - Database query (FAILING)
   - `loadRecentFullSnapshots()` - Supabase query (SUSPECT)
   - `buildMockProfile()` - Fallback (BEING USED)

2. **`web-next/src/app/player/[tag]/page.tsx`** (Lines 1-36)
   - SSR player page component
   - Calls `fetchPlayerProfile()`
   - Has caching disabled but still issues?

3. **`web-next/src/components/roster/RosterSummary.tsx`** (Lines 1-300+)
   - Infinite loop source
   - Fixed but still crashing on back navigation

4. **`web-next/src/lib/stores/dashboard-store.ts`** (Lines 1-600+)
   - State management
   - `isRefreshingData` guard added
   - May need more guards for navigation scenarios

### Related Files:
5. `web-next/src/lib/data-source.ts` - Data loading from Supabase
6. `web-next/src/app/api/player/[tag]/route.ts` - Player API endpoint
7. `web-next/src/components/roster/TableRow.tsx` - Click handlers

---

## 🔬 **WHAT WE'VE TRIED**

### Session Timeline (Oct 11, 2025):

#### **Attempt 1: Disable API Caching**
- Added `revalidate = 0` to `/api/player/[tag]/route.ts`
- **Result:** No change - still showing wrong player

#### **Attempt 2: Disable Page Caching**
- Added `revalidate = 0` + `dynamic = 'force-dynamic'` to player page
- **Result:** No change - still showing wrong player

#### **Attempt 3: Discovered Mock Data Fallback**
- Found `buildMockProfile` hardcoded to return "DoubleD"
- Updated to generate dynamic name from tag
- **Result:** Now shows `Player UU9G` instead of always `DoubleD`
- **Status:** Workaround - still using mock data!

#### **Attempt 4-8: Infinite Loop Fixes** (Earlier in session)
- Fixed RosterSummary subscriptions
- Added shallow comparison
- Added React.memo wrappers
- Fixed useMemo dependencies
- **Result:** Dashboard works, but back navigation still crashes

---

## 📊 **VERIFICATION DATA**

### What We Know Works:
✅ **Roster API:** `/api/v2/roster` returns correct data:
```json
{
  "name": "andrew",
  "tag": "#UU9GJ9QQ",
  "th": 14
}
```

✅ **Ingestion:** Fresh snapshot from Oct 9, 2025 exists  
✅ **Dashboard:** Loads without crashing  
✅ **League badges:** Display correctly (Wizard, Valkyrie, etc.)  
✅ **Table navigation:** Works within dashboard  

### What's Broken:
❌ **Player profiles:** Always show mock data  
❌ **Back navigation:** Crashes with infinite loop  
❌ **Database query:** `loadRecentFullSnapshots()` failing silently  

---

## 🎯 **INVESTIGATION NEEDED**

### Priority 1: Why is buildProfileFromSnapshots Returning Null?

**Debug Steps:**
1. Check `loadRecentFullSnapshots()` function (line 263)
   - Is it returning empty array?
   - Does it have correct Supabase query?
   - Is `clan_snapshots` table populated with Oct 9 data?

2. Check snapshot structure:
   - Does `clan_snapshots.player_details` field exist?
   - Is it properly populated during ingestion?
   - Is it a JSON object with tags as keys?

3. Check tag normalization:
   - Player tag in roster: `#UU9GJ9QQ`
   - How is it normalized in `playerDetails` object?
   - Is it `#UU9GJ9QQ`, `UU9GJ9QQ`, or something else?

4. Add aggressive debug logging:
   ```typescript
   console.log('Snapshots loaded:', snapshots.length);
   console.log('Latest snapshot ID:', latestSnapshot?.metadata?.id);
   console.log('Player details keys:', Object.keys(latestSnapshot.playerDetails || {}));
   console.log('Looking for normalized tag:', normalizedPlayerTag);
   console.log('Members count:', dailySnapshot.members.length);
   console.log('Member tags:', dailySnapshot.members.map(m => m.tag));
   ```

### Priority 2: Why Does Browser Back Navigation Crash?

**Debug Steps:**
1. Check if player page is setting any global state
2. Check if router history is corrupted
3. Check if there's a different code path for back navigation vs forward navigation
4. Add error boundary with detailed stack trace
5. Test with React DevTools Profiler to see re-render cascade

**Possible Solutions:**
- Add navigation guard in dashboard store
- Clear player profile cache on unmount
- Disable SSR for player pages entirely
- Use shallow routing to avoid full page load

---

## 🚨 **CRITICAL QUESTIONS FOR NEXT AGENT**

1. **Why does `loadRecentFullSnapshots()` fail?**
   - Is the Supabase query correct?
   - Does the table have the right structure?
   - Are player details being stored during ingestion?

2. **What is the EXACT tag format in `playerDetails`?**
   - With hash: `#UU9GJ9QQ`?
   - Without hash: `UU9GJ9QQ`?
   - Something else?

3. **Why does back navigation trigger infinite loop?**
   - Is there a state update in componentWillUnmount?
   - Is the router cache corrupted?
   - Is RosterSummary re-mounting incorrectly?

4. **Should player profiles even use SSR?**
   - Would client-side only be simpler?
   - Is the complexity worth it?

---

## 📋 **DEPLOYMENT HISTORY**

Recent commits related to this issue:

```
3bc1ced - 🐛 EMERGENCY FIX: Player profile falling back to hardcoded mock data
e4756e3 - 🐛 CRITICAL: Disable caching on player PAGE (not just API)
d10406c - 🐛 FIX: Disable caching for player API endpoint
0c831fd - 🐛 CRITICAL FIX: RosterSummary infinite loop on production
```

**Current Production Status:**
- Player profiles show mock data (Player UU9G format)
- Back navigation still crashes
- Dashboard works normally
- All other features functional

---

## 🎬 **RECOMMENDED NEXT STEPS**

1. **Investigate Supabase `clan_snapshots` table:**
   ```sql
   SELECT 
     snapshot_date,
     jsonb_object_keys(player_details) as player_tags
   FROM clan_snapshots 
   WHERE clan_tag = '2PR8R8V8P' 
   ORDER BY snapshot_date DESC 
   LIMIT 1;
   ```

2. **Add comprehensive debug logging to player-profile.ts:**
   - Log every step of `buildProfileFromSnapshots`
   - Log snapshot structure
   - Log tag normalization
   - Log member search results

3. **Test player profile with direct DB query:**
   - Manually verify player data exists
   - Verify tag format matches
   - Verify query is correct

4. **Fix back navigation crash:**
   - Add error boundary around RosterSummary
   - Add navigation guard in dashboard store
   - Test with React DevTools to identify trigger

5. **Consider architectural changes:**
   - Move player profiles to client-side only
   - Cache player data in localStorage
   - Use simpler routing strategy

---

## 💡 **CONTEXT FOR NEXT AGENT**

**What the User Wants:**
"I need someone to really tear deeply into this. You may have one or more .md files already outlining the issues. What I want is a new agent that will discover the bug report in the code and read it."

**Translation:**
- This bug is subtle and deep
- It's been through multiple attempted fixes
- The surface symptoms are misleading
- The root cause is in the data layer (Supabase queries)
- Need someone to methodically debug the database interaction

**Expert Mode Required:**
- Database schema investigation
- Supabase query debugging
- React state management deep dive
- SSR/hydration issues
- Tag normalization debugging

**Files to Read First:**
1. This document (you're reading it!)
2. `CRITICAL_INFINITE_LOOP_PATTERN.md` (has infinite loop context)
3. `EXPERT_SUMMARY_2025-10-09.md` (has overall project context)
4. `web-next/src/lib/player-profile.ts` (main culprit)

---

## 🏁 **SUCCESS CRITERIA**

The bug is FIXED when:
1. ✅ Clicking any player name navigates to THEIR profile (not mock data)
2. ✅ Player profile shows real data from database (name, stats, heroes)
3. ✅ Browser back button returns to dashboard WITHOUT crash
4. ✅ No "Maximum update depth exceeded" errors in console
5. ✅ All player navigation works in both directions

---

**Good luck, next agent! This is a tough one. 🫡**

**P.S.** The user has been EXTREMELY patient through all of this. They've been debugging with us for hours. Let's get this fixed properly!

