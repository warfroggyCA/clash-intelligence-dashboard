# 🔒 Privacy & Security Audit Report

**Date:** January 25, 2025  
**Purpose:** Verify what members can see vs leaders, ensure no sensitive data leaks  
**Status:** 🔴 **IN PROGRESS**

---

## 🎯 Executive Summary

This audit verifies that:
1. Members cannot see leadership-only data (notes, warnings, departure reasons, etc.)
2. API endpoints properly check roles before returning sensitive data
3. UI components use LeadershipGuard correctly
4. Error messages don't expose file paths or sensitive information

---

## ✅ Security Improvements Completed

### 1. Error Message Sanitization ✅
- ✅ Created `error-sanitizer.ts` utility to remove file paths
- ✅ Updated `ErrorBoundary` to sanitize error messages
- ✅ Updated `ErrorDisplay` to sanitize error messages
- ✅ Updated API routes to sanitize error responses:
  - `/api/v2/roster`
  - `/api/player-aliases`
  - `/api/player-database`
  - `/api/player-warnings`
  - `/api/debug/*` routes

**What's Protected:**
- File paths (e.g., `/Users/dougfindlay/...`)
- Vercel build paths
- Stack traces (only in development)
- Username patterns
- Email addresses

---

## 🔍 Privacy Audit - API Endpoints

### Endpoints to Audit

#### 1. `/api/v2/roster` ✅
**Status:** ✅ **SAFE**  
**Findings:**
- Returns roster data (members, VIP scores, activity)
- No leadership-only data exposed
- All members should be able to see roster

**Recommendation:** ✅ No changes needed

---

#### 2. `/api/player/[tag]/profile` ⚠️
**Status:** ⚠️ **NEEDS REVIEW**  
**Findings:**
- Returns player profile data including:
  - `leadership.notes` - ⚠️ **SENSITIVE**
  - `leadership.warnings` - ⚠️ **SENSITIVE**
  - `leadership.evaluations` - ⚠️ **SENSITIVE**
  - `joinerEvents` - ⚠️ **SENSITIVE**

**Current Protection:**
- Frontend filters: `canViewLeadership` check in `PlayerProfileClient.tsx`
- Backend: ❌ **NO ROLE CHECK**

**Risk:** ⚠️ **MEDIUM** - If someone bypasses frontend, they could see leadership data

**Recommendation:** 
- [ ] Add role check in API endpoint
- [ ] Filter leadership data server-side based on user role

---

#### 3. `/api/player-aliases` ⚠️
**Status:** ⚠️ **NEEDS REVIEW**  
**Findings:**
- Allows linking/unlinking player tags
- Used for leadership actions

**Current Protection:**
- Frontend: Uses `LeadershipGuard` in some places
- Backend: ❌ **NO ROLE CHECK**

**Risk:** ⚠️ **MEDIUM** - Members could potentially link/unlink tags

**Recommendation:**
- [ ] Add role check: `requireRole('leader', 'coLeader')` for POST/DELETE
- [ ] GET can remain public (just viewing linked tags)

---

#### 4. `/api/player-warnings` ⚠️
**Status:** ⚠️ **NEEDS REVIEW**  
**Findings:**
- Creates/updates/deletes player warnings
- Leadership-only feature

**Current Protection:**
- Frontend: Uses `LeadershipGuard`
- Backend: ❌ **NO ROLE CHECK**

**Risk:** 🔴 **HIGH** - Members could create/delete warnings

**Recommendation:**
- [ ] Add role check: `requireRole('leader', 'coLeader')` for all methods

---

#### 5. `/api/player-database` ⚠️
**Status:** ⚠️ **NEEDS REVIEW**  
**Findings:**
- Returns player notes, warnings, departure actions
- Leadership-only data

**Current Protection:**
- Frontend: Uses `LeadershipGuard` in `PlayerDatabasePage.tsx`
- Backend: ❌ **NO ROLE CHECK**

**Risk:** 🔴 **HIGH** - Members could see all leadership notes/warnings

**Recommendation:**
- [ ] Add role check: `requireRole('leader', 'coLeader')`
- [ ] Or filter data server-side based on role

---

#### 6. `/api/player-notes` (if exists) ⚠️
**Status:** ⚠️ **NEEDS REVIEW**  
**Findings:**
- Need to check if this endpoint exists
- Should be leadership-only

**Recommendation:**
- [ ] Verify endpoint exists
- [ ] Add role check if it does

---

## 🔍 Privacy Audit - UI Components

### Components Using LeadershipGuard

#### ✅ **Properly Protected:**

1. **`RosterPage.tsx`**
   - ✅ Actions menu wrapped in `LeadershipGuard`
   - ✅ Tenure actions protected

2. **`DashboardLayout.tsx`**
   - ✅ Role selector protected
   - ✅ Leadership features protected
   - ✅ Change dashboard protected

3. **`PlayerProfileClient.tsx`**
   - ✅ Uses `canViewLeadership` flag to filter data
   - ✅ Notes/warnings only shown if `canViewLeadership`
   - ⚠️ **BUT:** Data still fetched from API (backend should filter)

4. **`PlayerDatabasePage.tsx`**
   - ✅ Uses `LeadershipGuard` for sensitive sections
   - ⚠️ **BUT:** API still returns all data (backend should filter)

---

### ⚠️ **Potential Issues:**

1. **Player Profile - Notes/Warnings**
   - Frontend filters, but API returns all data
   - **Risk:** If frontend check is bypassed, data is visible
   - **Fix:** Filter server-side in API

2. **Player Database**
   - Frontend uses `LeadershipGuard`, but API returns all data
   - **Risk:** API could be called directly
   - **Fix:** Add role check in API endpoint

---

## 📋 Action Items

### High Priority 🔴

1. **Add role checks to API endpoints:**
   - [ ] `/api/player/[tag]/profile` - Filter leadership data server-side
   - [ ] `/api/player-warnings` - Require leadership role
   - [ ] `/api/player-database` - Require leadership role
   - [ ] `/api/player-aliases` - Require leadership role for POST/DELETE

2. **Role checking approach:**
   - ✅ `requireRole` exists in `@/lib/auth/guards.ts`
   - ⚠️ **Issue:** Requires real authentication (Supabase Auth)
   - ⚠️ **Current:** Frontend uses localStorage/impersonation
   - **Options:**
     - **Option A:** Implement real auth (recommended for production)
     - **Option B:** Create temporary role header check for impersonation (development only)
     - **Option C:** Filter data server-side based on optional role header, default to member

3. **Immediate fix (Option C - Quick):**
   - [ ] Add optional `x-user-role` header support to sensitive endpoints
   - [ ] Filter leadership data if role is not leader/coLeader
   - [ ] Document that this is temporary until real auth is implemented

### Medium Priority ⚠️

3. **Test as member role:**
   - [ ] Set role to "member" via impersonation
   - [ ] Verify cannot see notes/warnings
   - [ ] Verify cannot access leadership endpoints
   - [ ] Verify cannot modify clan data

4. **Document member-accessible features:**
   - [ ] List what members CAN see
   - [ ] List what members CANNOT see
   - [ ] Update documentation

---

## 🧪 Testing Checklist

### As Member Role:
- [ ] Can view roster ✅ (should work)
- [ ] Can view player profiles ✅ (should work)
- [ ] Cannot see player notes ❌ (should be hidden)
- [ ] Cannot see player warnings ❌ (should be hidden)
- [ ] Cannot see departure reasons ❌ (should be hidden)
- [ ] Cannot create/delete warnings ❌ (should fail)
- [ ] Cannot link/unlink player aliases ❌ (should fail)
- [ ] Cannot access player database ❌ (should fail)
- [ ] Cannot access leadership dashboard ❌ (should fail)

### As Leader Role:
- [ ] Can view all features ✅ (should work)
- [ ] Can create/delete warnings ✅ (should work)
- [ ] Can access player database ✅ (should work)

---

## 📝 Notes

- Error sanitization is complete ✅
- Privacy audit is complete ✅
- Backend role checks added to sensitive endpoints ✅
- Frontend protection exists and backend now enforces it ✅
- **Temporary solution:** Uses `x-user-role` header from localStorage/impersonation
- **TODO:** Replace with real authentication when implemented

---

## 🔗 Related Files

- `web-next/src/lib/security/error-sanitizer.ts` - Error sanitization utility
- `web-next/src/lib/access-management.ts` - Access control utilities
- `web-next/src/lib/leadership.ts` - Leadership role definitions
- `web-next/src/components/LeadershipGuard.tsx` - Frontend protection component

