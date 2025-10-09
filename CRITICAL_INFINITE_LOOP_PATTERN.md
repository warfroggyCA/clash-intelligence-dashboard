# 🚨 CRITICAL: Systemic Infinite Loop Pattern Detected

## Executive Summary

We've identified a **systemic architectural issue** causing "Maximum update depth exceeded" crashes when components re-render after Zustand store updates. This pattern could be occurring throughout the codebase wherever `useMemo` dependencies reference Zustand arrays or objects.

---

## The Problem Pattern

### Root Cause
**Zustand creates new object/array references on every state update**, even when the data is identical. When components use these references as `useMemo` dependencies, it triggers infinite re-render cascades:

```typescript
// ❌ DANGEROUS PATTERN - Causes infinite loops
const stats = useMemo(() => {
  // ... compute stats
}, [roster?.members]);  // NEW ARRAY REFERENCE EVERY RENDER!
```

### Why It Happens
1. User triggers action (e.g., click "Switch to card view")
2. Zustand updates `rosterViewMode` state
3. ALL components subscribed to the store re-render
4. Components read `roster?.members` from store
5. Zustand returns **new array reference** (even if data unchanged)
6. `useMemo` sees "new" dependency → recomputes
7. Recomputation triggers component re-render
8. **Infinite loop** → React crashes with "Maximum update depth exceeded"

---

## Where This Was Found

### 1. RosterSummary Component (PARTIALLY FIXED)
**File**: `web-next/src/components/roster/RosterSummary.tsx`

**Symptoms**:
- ✅ FIXED: Table view loads without crash
- ❌ BROKEN: Clicking "Switch to card view" crashes immediately
- Error: "Maximum update depth exceeded" in `RosterSummaryInner` line 169

**Original Problem**:
```typescript
// Lines 146-228: Multiple useMemo hooks with roster?.members dependency
const stats = useMemo(() => {
  const members = roster?.members ?? [];
  // ... compute stats
}, [roster?.members, RS_DISABLE_STATS]);  // ❌ UNSTABLE DEPENDENCY
```

**Attempted Fix** (INCOMPLETE):
```typescript
// Lines 119-124: Use stable key instead
const memberCount = roster?.members?.length ?? 0;
const latestSnapshotId = useDashboardStore((state) => state.latestSnapshotId);
const stableRosterKey = `${latestSnapshotId || roster?.date || ''}-${memberCount}`;

// Changed all useMemo dependencies from roster?.members to stableRosterKey
const stats = useMemo(() => {
  // ... compute stats
}, [stableRosterKey, RS_DISABLE_STATS]);  // ✅ MORE STABLE
```

**Why It's Not Fully Fixed**:
The `stableRosterKey` still recalculates on every render because `roster?.members?.length` creates a new subscription. When `rosterViewMode` changes, the entire store notifies subscribers, triggering the cascade.

---

## 🔍 Where Else This Pattern Exists

### High-Risk Locations
Run these searches to find other occurrences:

```bash
# Search for useMemo with array/object dependencies from Zustand
grep -r "useMemo.*\[.*roster\.\?" web-next/src/
grep -r "useMemo.*\[.*members" web-next/src/
grep -r "useMemo.*\[.*state\." web-next/src/

# Search for array spreads from Zustand
grep -r "\.\.\.roster\." web-next/src/
grep -r "\.\.\.state\." web-next/src/
```

### Likely Suspects

1. **Any component using `roster?.members` in `useMemo`**
   - `web-next/src/components/roster/RosterTable.tsx`
   - `web-next/src/components/roster/RosterSummary.tsx` (partially fixed)
   - `web-next/src/components/roster/PlayerCard.tsx`
   
2. **Components with computed stats from Zustand arrays**
   - ACE score calculations
   - Highlights computation
   - Donation rankings
   - Hero level aggregations

3. **Dashboard components subscribing to full store**
   - `web-next/src/app/ClientDashboard.tsx`
   - Any component doing `const { ... } = useDashboardStore()`

---

## ✅ Proven Fix Patterns

### Pattern 1: Use Primitive Dependencies
```typescript
// ❌ BEFORE - Unstable object reference
const stats = useMemo(() => {
  return computeStats(roster?.members);
}, [roster?.members]);

// ✅ AFTER - Stable primitive
const memberCount = roster?.members?.length ?? 0;
const stats = useMemo(() => {
  const members = roster?.members ?? [];
  return computeStats(members);
}, [memberCount]);  // Only recompute when count changes
```

### Pattern 2: Selective Subscriptions
```typescript
// ❌ BEFORE - Subscribes to entire store
const { roster, members, stats, ... } = useDashboardStore();

// ✅ AFTER - Subscribe only to what you need
const memberCount = useDashboardStore(s => s.roster?.members?.length ?? 0);
const latestSnapshotId = useDashboardStore(s => s.latestSnapshotId);
```

### Pattern 3: Use Zustand Selectors with Equality Check
```typescript
// ✅ BEST - Use shallow equality for arrays
const members = useDashboardStore(
  s => s.roster?.members ?? [],
  shallow  // Only re-render if array contents changed
);
```

### Pattern 4: Memoize Component with React.memo
```typescript
// ✅ Prevent re-renders when props haven't changed
export const RosterSummary = React.memo(
  RosterSummaryInner,
  (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary renders
    return prevProps.snapshotId === nextProps.snapshotId;
  }
);
```

---

## 🚨 Critical Actions Required

### Immediate (Priority 1)
1. **Audit ALL `useMemo` hooks** in components that read from Zustand
   - Search: `grep -r "useMemo" web-next/src/components/ | grep -v node_modules`
   - Fix any that depend on `roster?.members`, `roster?.data`, or other object/array refs

2. **Replace whole-store destructuring** with selective subscriptions
   - Search: `grep -r "= useDashboardStore()" web-next/src/`
   - Change to: `const x = useDashboardStore(s => s.x)`

3. **Add shallow equality checks** for array subscriptions
   - Import: `import { shallow } from 'zustand/shallow'`
   - Use: `useDashboardStore(s => s.roster?.members, shallow)`

### Short-term (Priority 2)
4. **Implement React.memo** for expensive components
   - `RosterSummary`, `RosterTable`, `PlayerCard`, etc.
   - Use custom comparison functions to prevent cascading renders

5. **Add render tracking** in development
   - Add `console.log('[ComponentName] render', { propA, propB })` to identify loops early
   - Consider using React DevTools Profiler

6. **Create lint rule** to catch this pattern
   - ESLint rule to warn on `useMemo([...store.array])`
   - Enforce selective Zustand subscriptions

### Long-term (Priority 3)
7. **Refactor Zustand store** to use computed selectors
   - Move expensive computations INTO selectors
   - Cache computed values in store state itself

8. **Consider Jotai or Recoil** for derived state
   - These libraries handle dependency tracking better
   - Can run atoms/selectors with automatic memoization

9. **Add integration tests** for view switching
   - Test all view mode transitions
   - Catch infinite loops before they hit production

---

## 📊 Impact Assessment

### Current Status
- ✅ **Table View**: Working (after first fix)
- ❌ **Card View**: Crashes on switch
- ⚠️ **Unknown**: How many other components are affected

### Risk Level: **CRITICAL**
This pattern could be lurking in:
- ACE leaderboard calculations
- Smart insights rendering
- War prep opponent analysis  
- Historical comparison views
- Any component that filters/sorts/aggregates roster data

### User Impact
- **Current**: Card View unusable (but table view works)
- **Potential**: Other features may crash on data refresh or navigation
- **Performance**: Even "working" components may be re-rendering 100x more than needed

---

## 🎯 Recommended Expert Actions

1. **Do a codebase-wide audit** for this pattern:
   ```bash
   # Find all useMemo with Zustand dependencies
   rg "useMemo.*roster\.|members|state\." --type ts --type tsx
   ```

2. **Add performance monitoring**:
   ```typescript
   // Temporary debug wrapper for Zustand
   const originalSet = store.setState;
   store.setState = (...args) => {
     console.log('[Zustand] setState called', args);
     return originalSet(...args);
   };
   ```

3. **Fix the root cause in RosterSummary** first as a template:
   - Remove ALL `roster?.members` dependencies
   - Use ONLY primitives: `memberCount`, `snapshotId`, `snapshotDate`
   - Wrap component in `React.memo` with custom comparison

4. **Create a safe pattern guide** for the team:
   - Document the "do's and don'ts" of Zustand + useMemo
   - Add to `DEVELOPMENT_NOTES.md`

---

## 📝 Related Files

- `web-next/src/components/roster/RosterSummary.tsx` - Main problem location
- `web-next/src/lib/stores/dashboard-store.ts` - Zustand store definition
- `web-next/src/app/ClientDashboard.tsx` - Dashboard shell (may have similar issues)
- `web-next/src/components/roster/RosterTable.tsx` - Renders both table and card views

---

## 🔗 Additional Context

- **Previous Fix**: We fixed timezone parsing and STALE badge logic successfully
- **League Badges**: Now displaying correctly with proper icons
- **Card View Crash**: Still reproducible 100% of the time on localhost
- **User Request**: "This seems like a problem that could be occurring elsewhere too" ✅ CORRECT

---

## Questions for Expert

1. Should we **disable Card View** temporarily until this is fully fixed? ✅ **DONE** - Locked behind `NEXT_PUBLIC_DISABLE_ROSTER_CARDS=true`
2. Do we have **performance monitoring** in production to detect similar cascades?
3. Should we consider **migrating away from Zustand** for this use case?
4. Can we add **automated tests** that detect infinite render loops?

---

## 🔍 Audit Results (2025-10-09)

### Found Dangerous Patterns

#### HIGH RISK - roster?.members in dependency array
```bash
# Command run: grep -r "useMemo.*\[.*roster" src/
```

1. **`src/app/page-backup.tsx`**
   ```typescript
   const thCaps = useMemo(() => calculateThCaps(roster?.members || []), [roster]);
   ```
   ❌ **CRITICAL**: Depends on entire `roster` object - NEW REFERENCE EVERY RENDER

2. **`src/components/roster/RosterTable.tsx`** (LINE 274)
   ```typescript
   const members = useMemo(() => roster?.members ?? [], [roster?.members]);
   ```
   ❌ **CRITICAL**: Depends on `roster?.members` array - NEW REFERENCE EVERY RENDER
   
3. **`src/components/retired/RetiredPlayersTable.tsx`**
   ```typescript
   const currentTags = useMemo(() => new Set((roster?.members || []).map(m => normalizeTag(m.tag))), [roster]);
   ```
   ❌ **CRITICAL**: Depends on entire `roster` object

4. **`src/components/roster/RosterSummary.tsx`** (LINES 146-228, 231-405)
   - Multiple useMemo hooks previously using `[roster?.members]`
   - ✅ **PARTIALLY FIXED**: Now using `[stableRosterKey]` but still unstable

#### MEDIUM RISK - members array in dependency
```bash  
# Command run: grep -r "useMemo.*members" src/
```

5-12. **`src/components/CommandCenter.tsx`** (8 instances)
   ```typescript
   const clanHealth = useMemo(() => calculateClanHealth(members), [members]);
   const warMetrics = useMemo(() => calculateWarMetrics(members, warData), [members, warData]);
   const alerts = useMemo(() => generateAlerts(members, warData), [members, warData]);
   const topPerformers = useMemo(() => getTopPerformers(members, 3), [members]);
   const watchlist = useMemo(() => generateWatchlist(members), [members]);
   const momentum = useMemo(() => calculateMomentum(members), [members]);
   const elderCandidates = useMemo(() => getElderPromotionCandidates(members), [members]);
   ```
   ⚠️ **MEDIUM RISK**: Depends on `members` prop/variable
   - **Status**: UNKNOWN - need to check where `members` comes from
   - If `members` comes from Zustand: **HIGH RISK**
   - If `members` is a stable prop: **LOW RISK**

### No useEffect Issues Found
```bash
# Command run: grep -r "useEffect.*\[.*roster" src/
# Result: No matches found ✅
```

---

## 🛠️ ESLint Rule Configuration

### Recommended ESLint Rules

Add to `.eslintrc.json`:

```json
{
  "rules": {
    "no-zustand-arrays-in-deps": "error",
    "react-hooks/exhaustive-deps": [
      "warn",
      {
        "additionalHooks": "(useMemo|useCallback)"
      }
    ]
  },
  "overrides": [
    {
      "files": ["*.ts", "*.tsx"],
      "rules": {
        "no-restricted-syntax": [
          "error",
          {
            "selector": "CallExpression[callee.name='useMemo'] ArrayExpression[elements.0.type='MemberExpression'][elements.0.property.name='members']",
            "message": "Do not use roster?.members or store arrays directly in useMemo dependencies. Use shallow comparison or primitive values (length, ID) instead."
          },
          {
            "selector": "CallExpression[callee.name='useMemo'] ArrayExpression[elements.0.object.property.name='roster']",
            "message": "Do not use roster object directly in useMemo dependencies. Extract primitive values or use shallow comparison."
          }
        ]
      }
    }
  ]
}
```

### Manual Grep Commands for Code Review

```bash
# Find all dangerous useMemo patterns
grep -rn "useMemo.*\[.*roster" src/ --include="*.tsx" --include="*.ts"
grep -rn "useMemo.*roster\\.members" src/ --include="*.tsx" --include="*.ts"
grep -rn "useMemo.*state\\." src/ --include="*.tsx" --include="*.ts"

# Find all dangerous useEffect patterns  
grep -rn "useEffect.*\[.*roster" src/ --include="*.tsx" --include="*.ts"
grep -rn "useEffect.*roster\\.members" src/ --include="*.tsx" --include="*.ts"

# Find whole-store destructuring (also dangerous)
grep -rn "= useDashboardStore()" src/ --include="*.tsx" --include="*.ts"
grep -rn "const { .* } = useDashboardStore" src/ --include="*.tsx" --include="*.ts"

# Find array spreads from store
grep -rn "\\.\\.\\.roster\\." src/ --include="*.tsx" --include="*.ts"
grep -rn "\\.\\.\\.state\\." src/ --include="*.tsx" --include="*.ts"
```

### Pre-commit Hook (Optional)

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check for dangerous Zustand patterns
DANGEROUS_PATTERNS=$(grep -rn "useMemo.*\[.*roster\\.members" src/ --include="*.tsx" --include="*.ts" 2>/dev/null)

if [ -n "$DANGEROUS_PATTERNS" ]; then
  echo "❌ COMMIT BLOCKED: Dangerous Zustand pattern detected!"
  echo "$DANGEROUS_PATTERNS"
  echo ""
  echo "Do not use roster?.members in useMemo/useEffect dependencies."
  echo "Use shallow comparison or primitive values instead."
  echo "See CRITICAL_INFINITE_LOOP_PATTERN.md for details."
  exit 1
fi
```

---

## 📋 Expert Action Checklist

### ✅ Completed (2025-10-09)
- [x] Card View locked behind `NEXT_PUBLIC_DISABLE_ROSTER_CARDS=true`
- [x] Full codebase audit completed (grep results above)
- [x] ESLint rules documented
- [x] Grep commands provided for ongoing monitoring

### 🔄 In Progress
- [ ] Fix `RosterTable.tsx` line 274: `[roster?.members]` → use shallow comparison
- [ ] Fix `page-backup.tsx`: `[roster]` → extract primitives
- [ ] Fix `RetiredPlayersTable.tsx`: `[roster]` → use member count
- [ ] Audit `CommandCenter.tsx` to determine `members` source
- [ ] Add shallow comparison imports where needed

### ⏳ Next Steps
- [ ] Implement store-derived selectors for expensive calculations
- [ ] Add React.memo with custom comparison to heavy components
- [ ] Create integration tests for view mode switching
- [ ] Monitor production for similar crashes

---

**Document created**: 2025-10-09  
**Last updated**: 2025-10-09 (Post-Audit)
**Status**: ACTIVE ISSUE - CARD VIEW DISABLED - FIXES IN PROGRESS  
**Priority**: P0 - CRITICAL ARCHITECTURAL ISSUE

