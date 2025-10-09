# Maximum Update Depth Exceeded - Debug Report

**Date**: October 9, 2025  
**Issue**: Maximum update depth exceeded when calling `refreshData()`  
**Status**: 🚨 CRITICAL - App crashes on refresh

## 🔍 Symptoms

1. **Initial Load**: ✅ Dashboard loads successfully without errors
2. **Cached Data**: Shows old data with TH0 and "Unranked League" badges (from Oct 8/9 8:51 AM)
3. **Clicking Refresh**: ❌ Triggers infinite re-render loop → "Maximum update depth exceeded" error
4. **Error Location**: `RosterSummaryInner` component

## 📊 Console Evidence

### Before Crash:
```
[ClientDashboard] soft refresh disabled (enable flag not set)
[ClientDashboard] soft refresh disabled (enable flag not set)
[ClientDashboard] soft refresh disabled (enable flag not set)
... (repeats 20+ times)
```

### Warning (Key Clue):
```
Warning: The result of getSnapshot should be cached to avoid an infinite loop
    at CommandRail (CommandRail.tsx:41:11)
```

### Error Stack:
```
Error: Maximum update depth exceeded. This can happen when a component 
repeatedly calls setState inside componentWillUpdate or componentDidUpdate.

    at RosterSummaryInner (RosterSummary.tsx:169:73)
    at RosterSummary (RosterSummary.tsx:129:82)
    at DashboardLayout (DashboardLayout.tsx:613:11)
    at ClientDashboardInner (ClientDashboard.tsx:149:11)
    at ClientDashboard (ClientDashboard.tsx:110:11)
```

## 🛠️ Fixes Attempted

### Fix #1: Remove `refreshData` from useEffect dependencies (ClientDashboard.tsx:132)
```typescript
// BEFORE:
}, [roster, dataAgeHours, clanTag, homeClan, initialClanTag, refreshData]);

// AFTER:
}, [roster, dataAgeHours, clanTag, homeClan, initialClanTag]); // refreshData removed
```
**Result**: Initial load works, but refresh still crashes

### Fix #2: Expert's one-shot guard for auto-load (DashboardLayout.tsx:178-199)
```typescript
const hasAttemptedHomeLoad = useRef(false);
useEffect(() => {
  if (!hasAttemptedHomeLoad.current && homeClan) {
    hasAttemptedHomeLoad.current = true;
    handleLoadHome();
  }
}, [clanTag, homeClan, handleLoadHome]);
```
**Result**: Didn't solve the refresh crash

## 🚨 Root Cause Analysis

### Primary Issue: Zustand Selector Identity Instability
The warning **"getSnapshot should be cached"** from `CommandRail.tsx:41` suggests that Zustand selectors are returning new objects on every render, causing `useSyncExternalStore` to trigger re-renders.

**Line 41** in CommandRail.tsx:
```typescript
const dataFetchedAt = useDashboardStore((state) => state.dataFetchedAt);
```

### Secondary Issue: refreshData() Triggers Multiple State Updates
When `refreshData()` is called, it:
1. Calls `loadRoster()` → updates `roster`, `snapshotMetadata`, `snapshotDetails`, etc.
2. Calls `loadSmartInsights()` → updates `smartInsights`, `smartInsightsStatus`, etc.
3. Calls `checkDepartureNotifications()` → updates `departureNotifications`

Each state update triggers re-renders of components subscribing to those values, which may trigger effects that cause more state updates → infinite loop.

### Tertiary Issue: Store Set Depth Logging
Console shows:
```
[DashboardStore.set depth=%d keys=%s] 1 roster,snapshotMetadata,snapshotDetails,...
[DashboardStore.set depth=%d keys=%s] 1 status
[DashboardStore.set depth=%d keys=%s] 1 message
... (multiple rapid-fire updates)
```

This confirms multiple state updates are happening in rapid succession, but depth=1 means they're not nested. The issue is that they're happening so fast React thinks it's an infinite loop.

## 📋 Components Involved

1. **ClientDashboard** → Re-renders on every store update (logs "soft refresh disabled" each time)
2. **CommandRail** → Has uncached `getSnapshot` causing Zustand selector instability  
3. **RosterSummaryInner** → Where the error finally surfaces (line 169)
4. **DashboardLayout** → Contains CommandRail, may be contributing to the cascade

## 🔧 Potential Solutions

### Option 1: Fix CommandRail Selector (Line 41)
Use a stable selector or `useMemo` to prevent `dataFetchedAt` from causing re-renders:
```typescript
const dataFetchedAt = useDashboardStore(
  useCallback((state) => state.dataFetchedAt, [])
);
```

### Option 2: Batch Store Updates in refreshData()
Use Zustand's batching to update multiple keys in a single render:
```typescript
refreshData: async () => {
  const updates = await Promise.all([
    loadRoster(),
    loadSmartInsights(),
    checkDepartureNotifications()
  ]);
  // Batch all updates into one set() call
  set({ ...allUpdates });
}
```

### Option 3: Disable CommandRail Temporarily
Add environment variable to disable CommandRail to confirm it's the source

### Option 4: Use React.memo() on Heavy Components
Prevent unnecessary re-renders:
```typescript
const CommandRail = React.memo(({ isOpen, onToggle }) => {
  // ... component code
});
```

## 🎯 Recommended Next Steps

1. **Verify the warning source**: Check `CommandRail.tsx:41` to identify which selector is uncached
2. **Fix selector stability**: Wrap selectors in `useCallback` or use stable references
3. **Test with CommandRail disabled**: Add `NEXT_PUBLIC_DISABLE_COMMAND_RAIL=true` to isolate
4. **Batch store updates**: Refactor `refreshData()` to minimize state update cascades

## 📁 Related Files

- `web-next/src/app/ClientDashboard.tsx` (lines 100-132: soft refresh useEffect)
- `web-next/src/components/layout/CommandRail.tsx` (line 41: uncached selector)
- `web-next/src/components/roster/RosterSummary.tsx` (line 92+: RosterSummaryInner)
- `web-next/src/lib/stores/dashboard-store.ts` (selectors and refreshData action)
- `web-next/src/components/layout/DashboardLayout.tsx` (lines 178-199: auto-load guard)

## 🌐 Environment

- **Platform**: localhost:5050
- **Supabase**: Connected and working (cache-busting fix applied)
- **API**: `/api/v2/roster` returns fresh data with league info ✅
- **Database**: Oct 9 snapshot with `ranked_league_name` populated ✅
- **Frontend**: Crashes when trying to display fresh data ❌

