# CoC API Player Detail Timeout Investigation

**Date**: October 9, 2025  
**Issue**: Player detail fetches timing out during ingestion  
**Impact**: No league badges, TH levels show as 1, no hero data

---

## 🔍 **Root Cause Found**

**All player detail API calls to Supercell are timing out (>60s)**, but direct curl calls from terminal work instantly (< 1 second).

### **Evidence:**

#### ✅ **Direct curl** to CoC API (from terminal):
```bash
curl "https://api.clashofclans.com/v1/players/%23VGQVRLRL"
```
- **Result**: Success in **0.337 seconds**
- **Data**: Full player details including `leagueTier: {id: 105000016, name: "Witch League 16"}`

#### ❌ **Server-side fetch** (from Next.js/ingestion):
```
[FullSnapshot] Failed to fetch player detail #UU9GJ9QQ Error: Timeout fetching player #UU9GJ9QQ
... (9 players timed out)
[FullSnapshot] Player detail cache stats — hits: 0, misses: 0, total: 0
```
- **Result**: ALL 19 players timeout after 60 seconds
- **Data**: Empty `playerDetails = {}`

---

## 🛠️ **Configuration Discovered**

### **Proxy Configuration:**
```
FIXIE_URL="http://fixie:Oug81SdBkZnv9Kd@criterium.usefixie.com:80"
```

### **Fetch Implementation** (`web-next/src/lib/coc.ts`):

**WITH Proxy** (when FIXIE_URL set):
```typescript
// Line 255: axios with 10-second timeout
timeout: 10000,
```

**WITHOUT Proxy** (direct fetch):
```typescript
// Lines 284-299: NO timeout set!
const res = await fetch(`${BASE}${path}`, {
  headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  cache: 'no-store',
});
```

---

## 🚨 **Problems Identified:**

1. **Fixie Proxy Timeout**: 10-second timeout might be too aggressive
2. **No Retry Logic**: Single failure = lost data  
3. **Serial Rate Limiting**: `await rateLimiter.acquire()` inside each promise might be causing queueing issues
4. **No Fetch Timeout**: Native fetch has no timeout, relies on wrapper's 60s timeout
5. **Localhost + Proxy**: Fixie proxy might not work well from localhost (designed for Vercel)

---

## ✅ **Temporary Fix Attempted:**

Disabled FIXIE_URL for localhost:
```bash
#FIXIE_URL="http://fixie:Oug81SdBkZnv9Kd@criterium.usefixie.com:80"
```

**Result**: Still 0 player details fetched (ingestion ran but playerDetails still empty)

---

## 📋 **Next Steps (Per Expert):**

1. ✅ **Confirmed**: CoC API works perfectly (< 1s response)
2. ❌ **Issue**: Server-side fetch in Next.js times out
3. 🔧 **Need**: Investigate why Node.js fetch is stalling when curl works fine
4. 🔧 **Suggested**: Add concurrency pool (5-10 parallel) + retry logic instead of longer timeout

---

## 🎯 **What Works:**

- ✅ Database schema (`ranked_league_name` column exists)
- ✅ Code extraction (`leagueTier.id/name` being extracted correctly)
- ✅ Supabase cache-busting (API returns fresh snapshots)
- ✅ Data transformation (maps correctly when data exists)
- ✅ CoC API token valid and working
- ✅ Expert's dashboard crash fix (`isRefreshingData` guard)

## ❌ **What's Broken:**

- ❌ Player detail fetches timeout in Next.js server environment
- ❌ `playerDetails = {}` (empty) during ingestion
- ❌ League badges show "Unranked" instead of custom Oct 2025 badges
- ❌ TH levels show 1 instead of real levels (13, 14, etc.)
- ❌ No hero data populates

---

## 🤔 **Questions for Expert:**

1. Why would `fetch()` in Next.js timeout when `curl` works instantly?
2. Is there a DNS/network configuration issue in the Next.js server environment?
3. Should we add a fetch timeout + retry wrapper?
4. Should we skip Fixie proxy entirely for localhost development?

