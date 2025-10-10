# 🚨 Card View Crash - Expert Investigation Required

## Issue Summary

**Symptom**: Clicking "Switch to card view" button causes immediate crash with "Maximum update depth exceeded" error.

**Severity**: P1 - Feature completely unusable, app crashes requiring page reload

**Current Status**: Card View button hidden via `NEXT_PUBLIC_DISABLE_ROSTER_CARDS=true` to prevent user access

---

## 🔍 Reproduction Steps

1. Load dashboard at `http://localhost:5050`
2. Dashboard loads successfully in Table View ✅
3. Click "Switch to card view" button
4. **CRASH**: "Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate."
5. Page shows React error boundary
6. **100% reproducible** - happens every time

---

## 🐛 Technical Details

### Error Message
```
Maximum update depth exceeded. This can happen when a component 
repeatedly calls setState inside componentWillUpdate or componentDidUpdate. 
React limits the number of nested updates to prevent infinite loops.
```

### Error Stack Trace
Points to `RosterSummaryInner` component (line 169 in the component)

### Console Logs Show
Infinite repetition of:
```
[ClientDashboard] soft refresh disabled (enable flag not set)
[ClientDashboard] soft refresh disabled (enable flag not set)
[ClientDashboard] soft refresh disabled (enable flag not set)
... (repeats hundreds of times)
```

### Component Tree When Crash Occurs
```
RosterSummaryInner (webpack-internal:///(app-pages-browser)/./src/components/roster/RosterSummary.tsx:169:73)
  └─ RosterSummary
      └─ BailoutToCSR
          └─ LoadableComponent
              └─ DashboardLayout
                  └─ ClientDashboardInner
                      └─ ClientDashboard
```

---

## 🔧 What We've Tried (All Failed to Fix)

### Attempt 1: Stable Dependencies in useMemo ❌
**Changed**: All `useMemo` dependencies from `[roster?.members]` to `[stableRosterKey]`
- Where `stableRosterKey = latestSnapshotId || roster?.date || ''`
- **Result**: Table View fixed, Card View still crashes

### Attempt 2: UseRef for Stable Key ❌
**Changed**: Stored `stableRosterKey` in a `useRef` to prevent recalculation
- **Result**: Anti-pattern, didn't work, still crashes

### Attempt 3: Member Count Dependency ❌
**Changed**: Dependencies from `[stableRosterKey]` to `[memberCount]`
- Where `memberCount = roster?.members?.length ?? 0`
- **Result**: Still crashes on Card View switch

### Attempt 4: React.memo Wrapper ❌
**Changed**: Wrapped `RosterSummaryInner` in `React.memo()`
- **Result**: Prevents some unnecessary renders, but Card View still crashes

### Attempt 5: Selective Subscriptions ❌
**Changed**: Replaced whole-store destructuring with individual selectors
```typescript
// Before: const { roster, sortKey, sortDir, ... } = useDashboardStore();
// After:  const roster = useDashboardStore(s => s.roster);
```
- **Result**: Improved performance, but Card View still crashes

### Attempt 6: Shallow Comparison ❌
**Tried**: Using Zustand's `shallow` equality function
- **Result**: TypeScript error (wrong API), reverted to useMemo approach
- **Still crashes** on Card View

---

## 🤔 Root Cause Hypothesis

### The Cascade Pattern

When `setRosterViewMode('cards')` is called:

1. **Zustand updates state** → `rosterViewMode: 'cards'`
2. **ALL components subscribed to store re-render** (even if they don't use `rosterViewMode`)
3. **RosterSummary re-renders** (it shouldn't care about view mode, but it subscribes to store)
4. **RosterSummary reads `roster` from store**
5. **Zustand returns NEW object reference** (even though data unchanged)
6. **ALL useMemo hooks in RosterSummary see "new" dependency**
7. **useMemos recompute** → trigger component update
8. **Component update** → read from store again → **INFINITE LOOP**

### Why Table View Works But Card View Doesn't

**Theory**: When switching to Card View, the rendering order or component lifecycle triggers the cascade differently than initial Table View render. Possibly:
- Card View components mount/unmount differently
- RosterSummary shouldn't render in Card View but still does
- Some subscription happens during the switch that doesn't happen on initial load

### The Deep Problem

This isn't just a `useMemo` dependency issue - it's that **RosterSummary is rendering at all** when we switch to Card View. The component tree shouldn't include RosterSummary in Card View, but it seems to persist during the transition.

---

## 💡 Potential Solutions (Needs Expert Review)

### Option 1: Unmount RosterSummary in Card View ⭐ RECOMMENDED
```typescript
// In ClientDashboard or parent component
{rosterViewMode === 'table' && <RosterSummary />}
{rosterViewMode === 'cards' && <RosterCards />}
```

**Pros**: Clean separation, components don't affect each other
**Cons**: Lose RosterSummary state when switching (probably fine)

### Option 2: Move Calculations to Store Selectors ⭐ EXPERT RECOMMENDED
```typescript
// In dashboard-store.ts
const selectors = {
  rosterStats: (state) => {
    const members = state.roster?.members ?? [];
    if (!members.length) return DEFAULT_STATS;
    
    return {
      memberCount: members.length,
      avgTH: computeAvgTH(members),
      avgTrophies: computeAvgTrophies(members),
      mostCommonLeague: computeMostCommonLeague(members),
      // ... all stats
    };
  },
};

// In component (no useMemo needed!)
const stats = useDashboardStore(selectors.rosterStats);
```

**Pros**: Single source of truth, automatic memoization, no component-level useMemo
**Cons**: Requires significant refactoring of RosterSummary

### Option 3: Separate Routes for Table vs. Card View
```typescript
// /dashboard/table
// /dashboard/cards
```

**Pros**: Complete isolation, no shared state issues
**Cons**: UX change, requires routing refactor

### Option 4: Disable RosterSummary Entirely in Card View
Add to RosterSummary:
```typescript
const rosterViewMode = useDashboardStore(s => s.rosterViewMode);
if (rosterViewMode === 'cards') return null;
```

**Pros**: Quick fix, prevents rendering
**Cons**: Card View loses the summary panel (might be fine?)

---

## 🧪 Debugging Tools for Expert

### Enable Debug Logging
Set in `.env.local`:
```bash
NEXT_PUBLIC_RS_DEBUG_LOG=true
```

This will log:
- `[RosterSummaryShell] render`
- `[RosterSummaryShell] effect mount`
- Render count tracking

### Profiling the Crash
```typescript
// Add to RosterSummaryInner (line ~100)
const renderCountRef = useRef(0);
renderCountRef.current += 1;
console.log('[RosterSummary] render count:', renderCountRef.current);

if (renderCountRef.current > 10) {
  console.error('[RosterSummary] INFINITE LOOP DETECTED!', {
    memberCount,
    stableRosterKey,
    latestSnapshotId,
    rosterDate: roster?.date,
  });
}
```

### React DevTools Profiler
1. Open React DevTools
2. Go to Profiler tab
3. Start recording
4. Click "Switch to card view"
5. See which components are re-rendering infinitely

---

## 📊 Impact Analysis

### User Impact
- **Current**: Users cannot access Card View
- **Workaround**: Table View has all functionality (sorting, filtering, all data)
- **Loss**: Nice-to-have alternate visualization only

### Code Health
- **Identified**: Systemic architectural issue affecting multiple components
- **Documented**: Full audit in `CRITICAL_INFINITE_LOOP_PATTERN.md`
- **Fixed**: 4/5 components fixed (RosterTable, page-backup, RetiredPlayersTable, partial RosterSummary)
- **Remaining**: RosterSummary still problematic in Card View context

---

## 🎯 Recommended Expert Actions

### Short-term (1-2 hours)
1. **Profile the crash** with React DevTools Profiler
2. **Try Option 1**: Conditionally unmount RosterSummary in Card View
3. **Test if that fixes** the crash without deeper refactoring

### Medium-term (1-2 days)
4. **Implement Option 2**: Move stats calculations into store selectors
5. **Remove all component-level useMemos** that depend on Zustand data
6. **Add shallow equality** to store selectors
7. **Re-enable Card View** and verify no crashes

### Long-term (1 week)
8. **Add integration tests** for view mode switching
9. **Implement render tracking** in development to catch future issues
10. **Document patterns** in development guidelines

---

## 📁 Affected Files

**Primary Issue**:
- `web-next/src/components/roster/RosterSummary.tsx` (1,100 lines)

**Related**:
- `web-next/src/components/roster/RosterTable.tsx` (renders both views)
- `web-next/src/lib/stores/dashboard-store.ts` (Zustand store)
- `web-next/src/app/ClientDashboard.tsx` (parent component)

**Safety Lock**:
- `web-next/env.example` (contains `NEXT_PUBLIC_DISABLE_ROSTER_CARDS=true`)

---

## ✅ Current Workaround

**Status**: STABLE - No user impact

- Card View button hidden from UI
- Table View fully functional
- All data accessible through Table View
- No crashes occurring in production

**Feature can remain disabled indefinitely** if Card View is low priority. Table View provides all essential functionality.

---

## 📞 Questions for Expert

1. **Priority**: Is Card View worth the refactoring effort, or can it stay disabled?
2. **Approach**: Should we try Option 1 (unmount) first as quick fix, or go straight to Option 2 (store selectors)?
3. **Timeline**: What's the target timeline for re-enabling Card View?
4. **Testing**: Should we add Playwright/Cypress tests for view switching before re-enabling?

---

**Document Created**: 2025-10-09  
**Issue ID**: CARD-VIEW-CRASH-001  
**Status**: 🔒 LOCKED - Awaiting Expert Architecture Review  
**Priority**: P1 - Feature Broken But Safely Disabled  
**User Impact**: LOW (workaround available)

