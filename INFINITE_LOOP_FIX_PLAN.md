# 🔧 INFINITE LOOP PATTERN - FIX PLAN

**Date:** January 26, 2025  
**Status:** 🔄 IN PROGRESS

---

## 📋 **AUDIT RESULTS**

### ✅ **ALREADY FIXED:**

**1. RosterTable.tsx** ✅
- **Lines 298-301:** Uses `memberCount` as dependency (CORRECT)
- **Line 333:** Uses `members.length` as dependency (CORRECT)
- **Line 339:** Uses `members.length, sortKey, sortDir, aceScoresByTag` (CORRECT)
- **Status:** NO ACTION NEEDED

**2. RosterSummary.tsx** ✅
- **Line 109:** Uses `useMemo(() => useDashboardStore.getState().roster, [latestSnapshotId, memberCount])`
- **Line 112:** Creates stable key: `${latestSnapshotId || rosterDate || ''}-${memberCount}`
- **Line 247:** Uses `stableRosterKey` as dependency (CORRECT)
- **Line 256:** Uses `stableRosterKey` as dependency (CORRECT)
- **Status:** NO ACTION NEEDED

**3. RetiredPlayersTable.tsx** ✅
- **Line 24:** Uses `memberCount` as dependency (CORRECT)
- **Status:** NO ACTION NEEDED

---

### ⚠️ **NEEDS FIX:**

**1. CommandCenter.tsx** 🔴 **CRITICAL**
**Location:** `/app/web-next/src/components/CommandCenter.tsx`

**Problem Lines:**
```typescript
// Line 26-28: members array comes from clanData?.members prop
const members: Member[] = useMemo(() => {
  return clanData?.members || [];
}, [clanData]); // ❌ WRONG - clanData creates new reference every render

// Lines 37-43: ALL use [members] as dependency
const clanHealth = useMemo(() => calculateClanHealth(members), [members]); // ❌
const warMetrics = useMemo(() => calculateWarMetrics(members, warData), [members, warData]); // ❌
const alerts = useMemo(() => generateAlerts(members, warData), [members, warData]); // ❌
const topPerformers = useMemo(() => getTopPerformers(members, 3), [members]); // ❌
const watchlist = useMemo(() => generateWatchlist(members), [members]); // ❌
const momentum = useMemo(() => calculateMomentum(members), [members]); // ❌
const elderCandidates = useMemo(() => getElderPromotionCandidates(members), [members]); // ❌
```

**Root Cause:**
- `clanData` is passed as a prop
- Even if `clanData?.members` has the same content, it's a NEW array reference each time
- Using `[members]` as dependency triggers infinite re-renders

**Fix Strategy:**
- Use `members.length` as dependency instead of `members` array
- Use `clanData?.members?.length` as dependency instead of `clanData`

---

## 🔧 **FIX IMPLEMENTATION**

### **Fix for CommandCenter.tsx:**

**Before (WRONG):**
```typescript
const members: Member[] = useMemo(() => {
  return clanData?.members || [];
}, [clanData]); // ❌ New reference every render

const clanHealth = useMemo(() => calculateClanHealth(members), [members]); // ❌
```

**After (CORRECT):**
```typescript
// Extract member count as stable primitive
const memberCount = clanData?.members?.length ?? 0;

const members: Member[] = useMemo(() => {
  return clanData?.members || [];
}, [memberCount]); // ✅ Stable primitive dependency

const clanHealth = useMemo(() => calculateClanHealth(members), [memberCount]); // ✅
```

**All Lines to Fix:**
1. Line 26-28: `members` useMemo dependency
2. Line 30-35: `warData` useMemo dependency
3. Line 37: `clanHealth` useMemo dependency
4. Line 38: `warMetrics` useMemo dependency
5. Line 39: `alerts` useMemo dependency
6. Line 40: `topPerformers` useMemo dependency
7. Line 41: `watchlist` useMemo dependency
8. Line 42: `momentum` useMemo dependency
9. Line 43: `elderCandidates` useMemo dependency
10. Line 44: `topWarPerformers` useMemo dependency

---

## ✅ **TESTING CHECKLIST**

After fixing CommandCenter.tsx:

- [ ] Verify Command Center renders without console errors
- [ ] Check React DevTools Profiler for excessive re-renders
- [ ] Navigate between tabs and verify no infinite loops
- [ ] Test with different clan sizes (5, 20, 50 members)
- [ ] Monitor browser console for "[RCA]" messages
- [ ] Use React DevTools to check render count (should be <5 per interaction)

---

## 📊 **IMPACT ASSESSMENT**

### **Before Fix:**
- CommandCenter likely experiences infinite loops
- Browser CPU usage spikes
- UI freezes or becomes unresponsive
- Console flooded with render logs

### **After Fix:**
- CommandCenter renders efficiently
- Stable performance regardless of data size
- No unnecessary re-calculations
- Normal CPU usage

---

## 🎯 **NEXT STEPS**

1. ✅ Fix CommandCenter.tsx
2. ⏭️ Test Command Center thoroughly
3. ⏭️ Remove `NEXT_PUBLIC_DISABLE_ROSTER_CARDS` flag
4. ⏭️ Test Card View (should work after fixes)
5. ⏭️ Full regression testing

---

**STATUS:** Ready to implement fix for CommandCenter.tsx
