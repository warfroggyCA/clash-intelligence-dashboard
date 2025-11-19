# Performance Assessment - Loading Time Analysis

**Date:** January 15, 2025  
**Status:** Assessment Only (No Changes Made)

## Executive Summary

Page loads have slowed down due to several factors:
- **791 console.log statements** across the codebase (production overhead)
- **Multiple permission fetches** on every page load and clan change
- **No server-side caching** (`force-dynamic` + `revalidate: 0`)
- **Large client-side data processing** (filtering, sorting, JSON parsing)
- **Sequential API calls** that could be parallelized
- **Excessive re-renders** from multiple useEffect hooks

## Critical Issues (High Impact)

### 1. Excessive Console Logging (791 statements)
**Impact:** Medium-High  
**Location:** 
- `web-next/src/app`: 357 statements
- `web-next/src/components`: 153 statements  
- `web-next/src/lib`: 281 statements

**Problem:** Console logging has overhead, especially in production. Many logs are in hot paths (renders, API calls, data processing).

**Recommendation:**
- Remove or wrap all `console.log` in `if (process.env.NODE_ENV === 'development')`
- Use a logging utility that can be disabled in production
- Keep only critical error logging (`console.error`)

**Estimated Improvement:** 5-15% faster renders, especially on slower devices

---

### 2. No Server-Side Caching
**Impact:** High  
**Location:** `web-next/src/app/page.tsx`

```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

**Problem:** Every page load triggers a full server-side fetch, even if data hasn't changed.

**Recommendation:**
- Use ISR (Incremental Static Regeneration) with `revalidate: 300` (5 minutes)
- Or use `unstable_cache` for the roster API call
- Keep `force-dynamic` only if real-time data is critical

**Estimated Improvement:** 50-80% faster initial page loads (after first load)

---

### 3. Permission Fetching on Every Clan Change
**Impact:** Medium-High  
**Location:** `web-next/src/hooks/useLeadership.ts` → `useCustomPermissions()`

**Problem:** 
- `useCustomPermissions` fetches from `/api/access/permissions` on every clan change
- Called by multiple hooks (`useLeadership`, `useRolePermissions`)
- No caching between components
- Multiple components might fetch simultaneously

**Current Flow:**
```
Page Load → useLeadership → useCustomPermissions → API call
Clan Change → useLeadership → useCustomPermissions → API call (again)
Another Component → useRolePermissions → useCustomPermissions → API call (duplicate)
```

**Recommendation:**
- Add SWR caching for permissions: `useSWR('/api/access/permissions?clanTag=...')`
- Share cache across all hooks
- Cache for 5 minutes (permissions don't change often)

**Estimated Improvement:** Eliminate 2-3 API calls per page load, 50-100ms faster

---

### 4. Large Client-Side Data Processing
**Impact:** Medium  
**Location:** `web-next/src/app/simple-roster/RosterPage.tsx`

**Problem:**
- `sortedMembers()` useMemo recalculates on every sort/filter change
- Complex sorting logic with multiple comparisons
- Filtering happens client-side after data is loaded
- Timeline building happens client-side

**Current Processing:**
```typescript
const sortedMembers = useMemo(() => {
  // Complex sorting with 15+ comparison cases
  // Filtering logic
  // Multiple array operations
}, [roster, sortKey, sortDirection]);
```

**Recommendation:**
- Move sorting/filtering to server-side API (query params)
- Or optimize with Web Workers for large datasets
- Use virtual scrolling for large rosters (50+ members)

**Estimated Improvement:** 20-40% faster renders for large rosters

---

### 5. Sequential API Calls in Player Database
**Impact:** Medium  
**Location:** `web-next/src/app/api/player-database/route.ts`

**Problem:**
- Fetches notes, warnings, tenure, departures in parallel (good)
- But then fetches player names sequentially for each tag
- Processes large JSON payloads client-side

**Current Flow:**
```
1. Fetch notes/warnings/tenure/departures (parallel) ✅
2. Collect unique tags
3. Fetch alias links
4. Fetch player names (could be parallelized)
5. Process and combine data
```

**Recommendation:**
- Batch player name fetches (single query with `IN` clause)
- Use database views or materialized views for common queries
- Add pagination for large datasets

**Estimated Improvement:** 30-50% faster Player Database loads

---

## Moderate Issues (Medium Impact)

### 6. Multiple useEffect Hooks Causing Re-renders
**Impact:** Medium  
**Location:** `web-next/src/app/simple-roster/RosterPage.tsx`

**Problem:**
- Multiple `useEffect` hooks with different dependencies
- Some check stale data every 5 minutes
- Some trigger re-renders unnecessarily

**Recommendation:**
- Combine related effects
- Use `useCallback` for handlers
- Debounce stale data checks

**Estimated Improvement:** 10-20% fewer re-renders

---

### 7. Large JSON Payloads
**Impact:** Medium  
**Location:** Multiple API routes

**Problem:**
- Roster API returns full member objects with all fields
- Player Database returns full note/action history
- No field selection (always fetches all columns)

**Recommendation:**
- Add field selection to API queries (`?fields=name,tag,trophies`)
- Use GraphQL-style field selection
- Compress responses (gzip is automatic, but ensure it's enabled)

**Estimated Improvement:** 20-30% smaller payloads, faster network transfer

---

### 8. No Request Deduplication
**Impact:** Low-Medium  
**Location:** Multiple components

**Problem:**
- Multiple components might fetch the same data simultaneously
- SWR has deduplication, but only within 5 seconds
- Initial page load might trigger duplicate requests

**Recommendation:**
- Ensure SWR deduplication window is appropriate (currently 5 minutes for roster)
- Use React Query's request deduplication if switching
- Prefetch critical data in `getInitialRosterData`

**Estimated Improvement:** Eliminate 1-2 duplicate requests per page load

---

### 9. Heavy Component Loading
**Impact:** Low-Medium  
**Location:** `web-next/src/app/simple-roster/RosterPage.tsx`

**Problem:**
- `DashboardLayout` is lazy loaded (good)
- But `RosterPlayerNotesModal`, `RosterPlayerTenureModal`, etc. are not
- Large modals loaded upfront

**Recommendation:**
- Lazy load modals: `const RosterPlayerNotesModal = dynamic(() => import('...'))`
- Code split by route (already done with Next.js App Router)

**Estimated Improvement:** 10-15% smaller initial bundle

---

### 10. Timeline Building in Roster API
**Impact:** Low-Medium  
**Location:** `web-next/src/app/api/v2/roster/route.ts`

**Problem:**
- Fetches 14 days of `player_day` data for all members
- Builds timeline client-side for each member
- This happens on every roster load

**Current Code:**
```typescript
const { data: playerDayRows } = await supabase
  .from('player_day')
  .select('...')
  .eq('clan_tag', clanTag)
  .gte('date', sinceIso) // 14 days
  .order('player_tag')
  .order('date');
```

**Recommendation:**
- Make timeline building optional (query param `?includeTimeline=false`)
- Or cache timeline data separately
- Or build timeline on-demand (when viewing player profile)

**Estimated Improvement:** 30-50% faster roster API response

---

## Low Priority Issues

### 11. Image Optimization
**Impact:** Low  
**Location:** Multiple components

**Problem:**
- Some images might not be optimized
- TH17 icon had cache-busting issues

**Recommendation:**
- Ensure all images use Next.js `Image` component
- Use `priority` prop for above-the-fold images
- Preload critical images

**Estimated Improvement:** 5-10% faster LCP (Largest Contentful Paint)

---

### 12. SWR Configuration
**Impact:** Low  
**Location:** `web-next/src/lib/api/swr-config.ts`

**Current Config:**
```typescript
revalidateIfStale: true, // Always revalidates if stale
dedupingInterval: 5000, // 5 seconds
```

**Recommendation:**
- Consider `revalidateIfStale: false` for roster (data changes daily via cron)
- Increase deduping interval for stable data

**Estimated Improvement:** Fewer unnecessary revalidations

---

## Performance Metrics to Track

1. **Time to First Byte (TTFB):** Currently unknown, should be < 200ms
2. **First Contentful Paint (FCP):** Should be < 1.8s
3. **Largest Contentful Paint (LCP):** Should be < 2.5s
4. **Time to Interactive (TTI):** Should be < 3.8s
5. **Total Blocking Time (TBT):** Should be < 200ms

---

## Recommended Action Plan (Priority Order)

### Phase 1: Quick Wins (1-2 hours)
1. ✅ Remove/wrap console.log statements in production checks
2. ✅ Add SWR caching for permissions (`useCustomPermissions`)
3. ✅ Make timeline building optional in roster API

**Expected Improvement:** 20-30% faster page loads

### Phase 2: Medium Effort (3-5 hours)
4. ✅ Implement ISR or caching for home page (`revalidate: 300`)
5. ✅ Optimize Player Database API (batch queries, pagination)
6. ✅ Lazy load modals and heavy components

**Expected Improvement:** 30-50% faster page loads

### Phase 3: Advanced (1-2 days)
7. ✅ Move sorting/filtering to server-side
8. ✅ Add field selection to API queries
9. ✅ Implement virtual scrolling for large rosters

**Expected Improvement:** 50-70% faster page loads

---

## Notes

- All timings are estimates based on code analysis
- Actual improvements may vary based on network conditions and device performance
- Some optimizations may require database schema changes
- Test performance improvements incrementally




