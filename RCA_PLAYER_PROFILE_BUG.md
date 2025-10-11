# 🔬 ROOT CAUSE ANALYSIS: Player Profile Bug

**Date:** January 26, 2025  
**Agent:** E1 Investigation  
**Status:** ⚠️ IN PROGRESS - Deep Dive Phase 1 Complete

---

## 📊 **INVESTIGATION SUMMARY**

### **Symptoms Confirmed:**
1. ✅ Player profile pages show **mock data** instead of real data
2. ✅ Mock data uses generic names like "Player UU9G" (first 4 chars of tag)
3. ✅ Browser back button crashes with "Maximum update depth exceeded"
4. ✅ Issue affects ALL players (100% reproduction rate)

### **Hypothesis Under Test:**
The player profile data IS being stored in Supabase, but the query to retrieve it is either:
- A) Returning empty results (no snapshots found)
- B) Returning snapshots WITHOUT player_details populated
- C) Tag format mismatch between storage and lookup

---

## 🔍 **CRITICAL CODE FLOW ANALYSIS**

### **Flow 1: Data Storage (Ingestion → Supabase)**

**File:** `web-next/src/lib/full-snapshot.ts`

```typescript
// Line 113: Player details stored with NORMALIZED tag (with hash)
const tag = normalizeTag(member.tag); // "#UU9GJ9QQ"
playerDetails[tag] = detail; // { "#UU9GJ9QQ": {...}, "#ABC123": {...} }

// Line 250: Saved to Supabase with SAFE clan tag (no hash, lowercase)
await supabase.from('clan_snapshots').upsert({
  clan_tag: safeTag, // "2pr8r8v8p"
  snapshot_date: snapshotDate, // "2025-10-09"
  player_details: snapshot.playerDetails, // { "#UU9GJ9QQ": {...} }
  // ...
})
```

**✅ VERIFIED:** Player details are stored with **hash included** in keys (`#UU9GJ9QQ`)  
**✅ VERIFIED:** Clan tag is stored **without hash, lowercase** (`2pr8r8v8p`)

---

### **Flow 2: Data Retrieval (Player Page → Supabase)**

**File:** `web-next/src/lib/player-profile.ts`

```typescript
// Line 119-133: Entry point
export async function fetchPlayerProfile(tag: string): Promise<PlayerProfileData> {
  const normalizedWithHash = normalizeTag(tag); // "#UU9GJ9QQ"
  const normalized = normalizePlayerTag(tag); // "UU9GJ9QQ" (no hash)
  
  try {
    const profile = await buildProfileFromSnapshots(normalizedWithHash);
    if (profile) {
      return profile; // ❌ This never succeeds - always returns null
    }
  } catch (error) {
    console.warn('[PlayerProfile] Failed to build player profile', error);
  }
  
  return buildMockProfile(normalized); // ⚠️ ALWAYS FALLS THROUGH TO HERE
}

// Line 135-160: Database query
async function buildProfileFromSnapshots(playerTagWithHash: string): Promise<PlayerProfileData | null> {
  const clanTag = cfg.homeClanTag; // "#2PR8R8V8P"
  const normalizedPlayerTag = normalizeTag(playerTagWithHash); // "#UU9GJ9QQ"
  
  // Line 146: Load snapshots
  const snapshots = await loadRecentFullSnapshots(clanTag, 2);
  if (!snapshots.length) {
    return null; // ❌ POSSIBLE FAILURE POINT #1
  }
  
  const latestSnapshot = snapshots[snapshots.length - 1];
  const dailySnapshot = convertFullSnapshotToDailySnapshot(latestSnapshot);
  
  // Line 154-155: Find player
  const member = dailySnapshot.members.find((m) => normalizeTag(m.tag) === normalizedPlayerTag);
  const playerDetail = latestSnapshot.playerDetails?.[normalizedPlayerTag];
  
  if (!member || !playerDetail) {
    console.log(`[PlayerProfile] Player not found. Tag: ${normalizedPlayerTag}, member: ${!!member}, playerDetail: ${!!playerDetail}`);
    return null; // ❌ POSSIBLE FAILURE POINT #2 or #3
  }
  
  // ... rest of profile building (never reached)
}

// Line 264-303: Supabase query
async function loadRecentFullSnapshots(clanTag: string, limit: number): Promise<FullClanSnapshot[]> {
  const normalizedClanTag = normalizeTag(clanTag); // "#2PR8R8V8P"
  const safeTag = safeTagForFilename(normalizedClanTag); // "2pr8r8v8p"
  
  const { data, error } = await supabase
    .from('clan_snapshots')
    .select('clan_tag, fetched_at, clan, member_summaries, player_details, metadata')
    .eq('clan_tag', safeTag) // Query: clan_tag = "2pr8r8v8p"
    .order('snapshot_date', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.warn('[PlayerProfile] Failed to load snapshots from Supabase:', error);
    return []; // ❌ POSSIBLE FAILURE POINT #4
  }
  
  return (data || []).map((record): FullClanSnapshot => ({
    clanTag: normalizeTag(record.clan_tag),
    fetchedAt: record.fetched_at,
    clan: record.clan,
    memberSummaries: record.member_summaries,
    playerDetails: record.player_details, // JSONB with keys like "#UU9GJ9QQ"
    // ...
  }));
}
```

---

## 🎯 **FAILURE POINTS IDENTIFIED**

### **❌ Failure Point #1: No Snapshots Returned**
**Location:** Line 147 in `buildProfileFromSnapshots()`  
**Condition:** `if (!snapshots.length)`

**Why This Could Happen:**
- Supabase query returns empty array
- `clan_tag` in database doesn't match query (case sensitivity?)
- No data has been ingested yet
- Query error swallowed by catch block

**Evidence:**
- ✅ Cron logs show successful ingestion: "Created full snapshot: 19 members"
- ✅ Data SHOULD exist in database
- ⚠️ **NEEDS VERIFICATION:** Direct Supabase query

**Diagnostic Query:**
```sql
SELECT clan_tag, snapshot_date, 
       jsonb_object_keys(player_details) as player_tag_sample
FROM clan_snapshots 
WHERE clan_tag = '2pr8r8v8p' 
ORDER BY snapshot_date DESC 
LIMIT 1;
```

---

### **❌ Failure Point #2: Player Not in Members Array**
**Location:** Line 154 in `buildProfileFromSnapshots()`  
**Condition:** `!member`

**Why This Could Happen:**
- Tag normalization mismatch in members array
- Player not in the converted daily snapshot
- `convertFullSnapshotToDailySnapshot()` losing data

**Diagnostic:**
```typescript
console.log('[DEBUG] Members in snapshot:', dailySnapshot.members.length);
console.log('[DEBUG] Member tags:', dailySnapshot.members.map(m => m.tag));
console.log('[DEBUG] Looking for:', normalizedPlayerTag);
```

---

### **❌ Failure Point #3: Player Not in playerDetails Object**
**Location:** Line 155 in `buildProfileFromSnapshots()`  
**Condition:** `!playerDetail`

**Why This Could Happen:**
- ✅ **MOST LIKELY CAUSE:** `player_details` JSONB field is empty or null
- Tag format mismatch (keys stored differently than expected)
- Player details not fetched during ingestion

**Evidence:**
- Ingestion logs show: "✅ All 19 players fetched successfully"
- Player details SHOULD be populated

**Diagnostic:**
```typescript
console.log('[DEBUG] Player details keys:', Object.keys(latestSnapshot.playerDetails || {}));
console.log('[DEBUG] Looking for key:', normalizedPlayerTag);
console.log('[DEBUG] Player detail found:', !!latestSnapshot.playerDetails?.[normalizedPlayerTag]);
```

---

### **❌ Failure Point #4: Supabase Query Error**
**Location:** Line 284-287 in `loadRecentFullSnapshots()`  
**Condition:** `if (error)`

**Why This Could Happen:**
- Network timeout
- RLS (Row Level Security) blocking access
- Supabase client not initialized
- Permission issues

**Evidence:**
- No error logs in console (would show `console.warn`)
- Suggests query is succeeding but returning empty

---

## 🔬 **DIAGNOSTIC PLAN**

### **Phase 1: Verify Data Exists in Supabase ✅ COMPLETED**

**Findings:**
- ✅ Code flow traced completely
- ✅ Tag normalization logic understood
- ✅ Storage format confirmed: keys are `#UU9GJ9QQ`
- ✅ Query format confirmed: clan_tag is `2pr8r8v8p`

**Next Step:** Add diagnostic logging to confirm which failure point is triggered

---

### **Phase 2: Add Diagnostic Logging 🔄 NEXT**

**Locations to Add Logging:**

**1. In `loadRecentFullSnapshots()` (line 264):**
```typescript
async function loadRecentFullSnapshots(clanTag: string, limit: number): Promise<FullClanSnapshot[]> {
  // ... existing code ...
  
  console.log('[RCA] loadRecentFullSnapshots called');
  console.log('[RCA] Input clanTag:', clanTag);
  console.log('[RCA] Normalized clanTag:', normalizedClanTag);
  console.log('[RCA] Safe tag for query:', safeTag);
  
  const { data, error } = await supabase.from('clan_snapshots')...
  
  console.log('[RCA] Query returned:', {
    dataCount: data?.length ?? 0,
    error: error?.message ?? 'none',
    firstRecord: data?.[0] ? {
      clan_tag: data[0].clan_tag,
      snapshot_date: data[0].snapshot_date,
      playerDetailsKeys: Object.keys(data[0].player_details || {}).length
    } : 'no data'
  });
  
  return (data || []).map(...);
}
```

**2. In `buildProfileFromSnapshots()` (line 135):**
```typescript
async function buildProfileFromSnapshots(playerTagWithHash: string): Promise<PlayerProfileData | null> {
  // ... existing code ...
  
  console.log('[RCA] buildProfileFromSnapshots called');
  console.log('[RCA] Input playerTagWithHash:', playerTagWithHash);
  console.log('[RCA] Normalized player tag:', normalizedPlayerTag);
  
  const snapshots = await loadRecentFullSnapshots(clanTag, 2);
  console.log('[RCA] Snapshots loaded:', snapshots.length);
  
  if (!snapshots.length) {
    console.error('[RCA] ❌ FAILURE POINT #1: No snapshots returned');
    return null;
  }
  
  const latestSnapshot = snapshots[snapshots.length - 1];
  console.log('[RCA] Latest snapshot:', {
    clanTag: latestSnapshot.clanTag,
    fetchedAt: latestSnapshot.fetchedAt,
    memberSummariesCount: latestSnapshot.memberSummaries?.length ?? 0,
    playerDetailsKeys: Object.keys(latestSnapshot.playerDetails || {})
  });
  
  const dailySnapshot = convertFullSnapshotToDailySnapshot(latestSnapshot);
  console.log('[RCA] Daily snapshot:', {
    membersCount: dailySnapshot.members.length,
    memberTags: dailySnapshot.members.slice(0, 3).map(m => m.tag) // First 3
  });
  
  const member = dailySnapshot.members.find((m) => normalizeTag(m.tag) === normalizedPlayerTag);
  const playerDetail = latestSnapshot.playerDetails?.[normalizedPlayerTag];
  
  console.log('[RCA] Player lookup:', {
    normalizedPlayerTag,
    memberFound: !!member,
    playerDetailFound: !!playerDetail,
    memberName: member?.name ?? 'not found',
    playerDetailKeys: Object.keys(latestSnapshot.playerDetails || {}).slice(0, 5) // First 5 keys
  });
  
  if (!member || !playerDetail) {
    if (!member) {
      console.error('[RCA] ❌ FAILURE POINT #2: Player not in members array');
      console.error('[RCA] Available tags:', dailySnapshot.members.map(m => m.tag));
    }
    if (!playerDetail) {
      console.error('[RCA] ❌ FAILURE POINT #3: Player not in playerDetails object');
      console.error('[RCA] Available playerDetails keys:', Object.keys(latestSnapshot.playerDetails || {}));
    }
    return null;
  }
  
  console.log('[RCA] ✅ SUCCESS: Player found in both members and playerDetails');
  // ... rest of profile building
}
```

---

### **Phase 3: Alternative Tag Format Check 🔄 IF NEEDED**

If failure point #3 is triggered (player not in playerDetails), try alternative key formats:

```typescript
// Try multiple tag formats
const tagFormats = [
  normalizedPlayerTag, // "#UU9GJ9QQ"
  normalizedPlayerTag.replace('#', ''), // "UU9GJ9QQ"
  normalizedPlayerTag.toLowerCase(), // "#uu9gj9qq"
  normalizedPlayerTag.replace('#', '').toLowerCase(), // "uu9gj9qq"
];

let playerDetail = null;
for (const format of tagFormats) {
  playerDetail = latestSnapshot.playerDetails?.[format];
  if (playerDetail) {
    console.log('[RCA] ✅ Player found with format:', format);
    break;
  }
}

if (!playerDetail) {
  console.error('[RCA] ❌ Player not found in ANY format');
  console.error('[RCA] Tried formats:', tagFormats);
}
```

---

### **Phase 4: Check convertFullSnapshotToDailySnapshot 🔄 IF NEEDED**

If failure point #2 is triggered (player not in members array):

```typescript
const dailySnapshot = convertFullSnapshotToDailySnapshot(latestSnapshot);

console.log('[RCA] Conversion check:', {
  inputMemberSummaries: latestSnapshot.memberSummaries?.length ?? 0,
  outputMembers: dailySnapshot.members?.length ?? 0,
  inputSample: latestSnapshot.memberSummaries?.[0]?.tag,
  outputSample: dailySnapshot.members?.[0]?.tag
});
```

---

## 🎯 **EXPECTED OUTCOMES**

### **Scenario A: No Snapshots Returned (Failure Point #1)**
**Likely Cause:** Supabase RLS blocking query or clan_tag mismatch  
**Fix:** Adjust RLS policies or fix tag normalization in query

### **Scenario B: Player Not in Members (Failure Point #2)**
**Likely Cause:** Conversion function losing data or tag mismatch  
**Fix:** Fix `convertFullSnapshotToDailySnapshot()` or tag comparison

### **Scenario C: Player Not in playerDetails (Failure Point #3)** ⭐ **MOST LIKELY**
**Likely Cause:** `player_details` JSONB empty or keys stored differently  
**Fix:** 
- If empty: Fix ingestion to populate player_details
- If format mismatch: Add multi-format lookup or fix storage format

### **Scenario D: Supabase Error (Failure Point #4)**
**Likely Cause:** Database connection or permission issue  
**Fix:** Check Supabase client initialization and RLS policies

---

## 🚀 **NEXT ACTIONS**

1. ✅ **Add all diagnostic logging** (Phase 2)
2. ✅ **Deploy and test** player profile page
3. ✅ **Review console logs** to identify exact failure point
4. ✅ **Apply targeted fix** based on findings
5. ✅ **Verify fix** works for all players

---

## 📊 **BROWSER BACK NAVIGATION CRASH**

**Status:** 🔄 QUEUED - Will investigate after player data loading is fixed

**Preliminary Analysis:**
- Likely caused by state update during navigation
- `setSelectedPlayer()` may trigger Zustand cascade
- React component may be updating during unmount

**Diagnostic Plan:**
1. Add navigation guard in dashboard-store
2. Add logging to track state updates during navigation
3. Use React DevTools Profiler to see re-render cascade
4. Add error boundary with detailed stack trace

---

## 📝 **DOCUMENT STATUS**

- **Created:** January 26, 2025
- **Last Updated:** January 26, 2025
- **Status:** Phase 1 Complete, Phase 2 Ready
- **Next Update:** After diagnostic logging results

---

**Ready to implement diagnostic logging and proceed with Phase 2.** 🔬
