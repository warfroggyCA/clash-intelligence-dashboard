# Old Architecture Remnants Audit
**Date:** January 25, 2025

## 🎯 Summary

After migrating to Simple Architecture, there are still some remnants of the old complex architecture in both code and planning documents. This document tracks what exists but is no longer actively used.

---

## 📁 Code Remnants

### 1. **ClientDashboard.tsx** - ⚠️ EXISTS BUT NOT USED
**Location:** `web-next/src/app/ClientDashboard.tsx`

**Status:** 
- File exists and contains old complex Zustand-based architecture
- Uses `useDashboardStore`, `useShallow`, complex state management
- **NOT used by main page** - `/page.tsx` uses `SimpleRosterPage` instead
- Can be disabled via `NEXT_PUBLIC_DISABLE_CLIENT_DASHBOARD=true`

**Usage Check:**
- ✅ Main route (`/`) uses `SimpleRosterPage`
- ❌ No imports found in active code paths
- ⚠️ `ClientAppShell.tsx` still references it but has disable flag

**Recommendation:** 
- Mark as deprecated/retired
- Move to `_retired_reference` folder
- Or delete if not needed for reference

---

### 2. **ClientAppShell.tsx** - ⚠️ EXISTS BUT NOT USED
**Location:** `web-next/src/components/ClientAppShell.tsx`

**Status:**
- Wraps `ClientDashboard` with error boundaries
- Has disable flag: `NEXT_PUBLIC_DISABLE_CLIENT_DASHBOARD`
- **NOT used by main page**

**Recommendation:**
- Same as ClientDashboard - mark deprecated or move to retired

---

### 3. **WCI Score Code** - ⚠️ EXISTS BUT REPLACED
**Location:** `web-next/src/lib/metrics/wci.ts`

**Status:**
- Code still exists for Weekly Competitive Index (WCI)
- **VIP Score replaced WCI** as primary metric
- Not actively used in UI (VIP is used instead)

**Usage Check:**
- ❌ No active imports found in app code
- ⚠️ Planning docs reference WCI but it's deprecated

**Recommendation:**
- Mark file as deprecated
- Add deprecation comment
- Or move to `_retired_reference`

---

### 4. **Deprecated API Endpoint** - ✅ PROPERLY MARKED
**Location:** `web-next/src/app/api/roster/route.ts`

**Status:**
- ✅ Properly marked as deprecated
- Redirects to `/api/v2/roster`
- Returns proper deprecation headers
- This is **good practice** for backwards compatibility

**Recommendation:**
- ✅ Keep as-is (good for backwards compatibility)
- Can remove after sufficient deprecation period

---

### 5. **Retired Reference Folder** - ✅ PROPERLY ARCHIVED
**Location:** `web-next/src/_retired_reference/`

**Contents:**
- `old-pages/ClientDashboard.tsx` (retired version)
- `roster-complex/` - Old complex roster components
- `player-complex/` - Old complex player components

**Status:**
- ✅ Properly archived in `_retired_reference` folder
- ❌ No active imports (verified)
- ✅ Good reference if needed

**Recommendation:**
- ✅ Keep as reference (already properly isolated)
- Can delete when confident old code not needed

---

### 6. **CommandRail References** - ⚠️ CSS ONLY
**Location:** `web-next/src/app/globals.css`

**Status:**
- CSS classes for `.command-rail-*` exist
- CommandRail component removed/disabled
- CSS remnants left behind

**Recommendation:**
- Remove unused CSS classes to clean up stylesheet

---

## 📄 Planning Document Remnants

### 1. **WAY_FORWARD_MASTER_PLAN.md**
**Issues:**
- References "Complex Main Dashboard (Zustand-based `/`)" as problematic
- Says "Dual architecture (simple vs. complex)"
- References WCI proposal (now replaced by VIP)
- References CommandRail as disabled placeholder

**Recommendation:**
- Update to reflect current state (simple architecture is primary)
- Mark old references as historical context

---

### 2. **FEATURE_INVENTORY.md**
**Issues:**
- References "Weekly Competitive Index (WCI)" ⭐ PRIMARY METRIC
- Says "Replace ACE score with WCI"
- References "ACE replaced by WCI"
- Mentions "Obsolete metrics (ACE replaced by WCI)"

**Recommendation:**
- Update: ACE → VIP (not WCI)
- Remove WCI references (VIP is the metric now)

---

### 3. **PLANNING_NOTES.md**
**Issues:**
- References complex architecture in multiple places
- Mentions "Dual architecture" decisions
- Some sprint items reference old patterns

**Recommendation:**
- Update sprint statuses (Sprint 1 is mostly complete)
- Mark old architecture decisions as historical

---

### 4. **ORIGINAL_DASHBOARD_FEATURES.md**
**Status:** ✅ **Good** - Properly documented as "Original" (historical reference)

---

## 🧹 Cleanup Recommendations

### Priority 1: Update Planning Docs (Low Risk)
1. Update `FEATURE_INVENTORY.md` - Change ACE→WCI→VIP references
2. Update `WAY_FORWARD_MASTER_PLAN.md` - Mark old architecture sections as historical
3. Update `PLANNING_NOTES.md` - Update sprint statuses

### Priority 2: Code Cleanup (Medium Risk)
1. **ClientDashboard.tsx** - Move to `_retired_reference` or delete
2. **ClientAppShell.tsx** - Move to `_retired_reference` or delete
3. **WCI code** - Add deprecation comment or move to retired
4. **CommandRail CSS** - Remove unused CSS classes

### Priority 3: Keep (Low Priority)
1. **Retired Reference Folder** - Keep as reference (already isolated)
2. **Deprecated API Endpoint** - Keep for backwards compatibility

---

## ✅ What's Already Clean

- ✅ Main route uses Simple Architecture
- ✅ No active imports of retired components
- ✅ Retired code properly isolated in `_retired_reference/`
- ✅ Deprecated API properly marked
- ✅ Master Plan correctly documents Simple Architecture

---

## 📊 Summary Table

| Item | Location | Status | Action Needed |
|------|----------|--------|---------------|
| ClientDashboard.tsx | `app/ClientDashboard.tsx` | Unused | Move to retired or delete |
| ClientAppShell.tsx | `components/ClientAppShell.tsx` | Unused | Move to retired or delete |
| WCI code | `lib/metrics/wci.ts` | Unused | Add deprecation or retire |
| Deprecated API | `app/api/roster/route.ts` | Marked deprecated | ✅ Keep (backwards compat) |
| Retired Reference | `_retired_reference/` | Archived | ✅ Keep (reference) |
| CommandRail CSS | `globals.css` | Unused classes | Remove unused CSS |
| Planning docs | Various `.md` files | Outdated references | Update references |

---

## 🎯 Recommended Actions

1. **Immediate (Low Risk):**
   - Update planning docs to reflect VIP (not WCI)
   - Mark WCI code as deprecated
   - Remove CommandRail CSS classes

2. **Short-term (Medium Risk):**
   - Move ClientDashboard/ClientAppShell to retired folder
   - Verify no external dependencies before deletion

3. **Long-term (When Confident):**
   - Delete retired reference folder (after sufficient time)
   - Remove deprecated API endpoint (after deprecation period)

