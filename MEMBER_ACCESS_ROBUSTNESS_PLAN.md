# 🛡️ Member Access Robustness Plan

**Date:** November 8, 2025  
**Goal:** Make dashboard production-ready for clan members (not just leaders)  
**Focus:** Robustness, stability, and security over new features

---

## 🎯 Current State Assessment

### ✅ What's Already Working
- ✅ Role-based permissions system exists (`ACCESS_LEVEL_PERMISSIONS`)
- ✅ LeadershipGuard component for access control
- ✅ Basic error boundary (`RootErrorBoundary`)
- ✅ Mobile-responsive design
- ✅ Data pipeline is stable (cron working)
- ✅ VIP scores calculating correctly

### 🔴 Critical Gaps for Member Access

1. **Authentication** - Using localStorage/impersonation, not real auth
2. **Error Handling** - Basic boundaries, no graceful degradation
3. **Loading States** - Inconsistent, some pages show nothing while loading
4. **API Error Recovery** - No retry logic, poor error messages
5. **Performance** - No caching, slow navigation
6. **Privacy** - Need to verify what members can see vs leaders
7. **Monitoring** - No error tracking (Sentry), no performance monitoring

---

## 🚨 Priority 1: Security & Authentication (CRITICAL)

### Current Issue
- Access control uses localStorage and role impersonation
- No real authentication system
- Members could potentially access leader-only features

### Required Work

#### 1.1 Implement Real Authentication ⭐ **MUST HAVE**
**Status:** Architecture exists, needs implementation

**Tasks:**
- [ ] Set up Supabase Auth (email magic links or OAuth)
- [ ] Create `/api/session` endpoint to return current user + roles
- [ ] Replace localStorage role picker with real auth
- [ ] Sync `user_roles` table with in-game roles on ingestion
- [ ] Add session management (logout, token refresh)

**Files to Modify:**
- `web-next/src/lib/auth/guards.ts` - Already exists, needs wiring
- `web-next/src/hooks/useLeadership.ts` - Replace localStorage with auth
- `web-next/src/app/api/session/route.ts` - Create new endpoint
- `web-next/src/components/layout/DashboardLayout.tsx` - Add auth check

**Estimated Effort:** 2-3 days

---

#### 1.2 Verify Privacy Boundaries ⭐ **MUST HAVE**
**Status:** Need to audit what members can see

**Questions to Answer:**
- Can members see other members' notes? (Should be NO)
- Can members see Command Center alerts? (Should be NO)
- Can members see departure reasons? (Should be NO)
- Can members see applicant evaluations? (Should be NO)
- Can members see Discord webhook config? (Should be NO)

**Tasks:**
- [ ] Audit all API endpoints for proper role checks
- [ ] Audit all UI components for LeadershipGuard usage
- [ ] Test as "member" role to verify access restrictions
- [ ] Add RLS policies if needed (currently backend-only access)

**Files to Audit:**
- All `/api/*` routes - Check for `requireRole` usage
- All components with sensitive data
- `web-next/src/lib/access-management.ts` - Verify permissions

**Estimated Effort:** 1-2 days

---

## 🚨 Priority 2: Error Handling & Stability (CRITICAL)

### Current Issues
- Basic error boundary catches crashes but shows generic message
- No graceful degradation when API fails
- Infinite loop bugs documented (React 185 errors)
- No retry logic for failed API calls

### Required Work

#### 2.1 Enhanced Error Boundaries ⭐ **MUST HAVE**
**Status:** Basic boundary exists, needs improvement

**Tasks:**
- [ ] Add error boundaries to key sections (Roster, Player Profile, Command Center)
- [ ] Create user-friendly error messages (not technical stack traces)
- [ ] Add "Retry" buttons to error states
- [ ] Log errors to monitoring service (Sentry)
- [ ] Show helpful messages: "Unable to load roster. Please refresh."

**Files to Create/Modify:**
- `web-next/src/components/ErrorBoundary.tsx` - Enhanced version
- `web-next/src/app/simple-roster/RosterPage.tsx` - Wrap in boundary
- `web-next/src/app/player/[tag]/PlayerProfileClient.tsx` - Wrap in boundary

**Estimated Effort:** 1 day

---

#### 2.2 API Error Recovery ⭐ **MUST HAVE**
**Status:** Some retry logic exists in CoC API, needs expansion

**Tasks:**
- [ ] Add retry logic to all API calls (3 attempts with exponential backoff)
- [ ] Show loading states during retries
- [ ] Display user-friendly error messages
- [ ] Handle rate limiting gracefully (429 errors)
- [ ] Handle network failures (offline detection)

**Files to Modify:**
- `web-next/src/lib/api/client.ts` - Add retry logic
- `web-next/src/app/api/v2/roster/route.ts` - Add error handling
- `web-next/src/app/api/v2/player/[tag]/profile/route.ts` - Add error handling

**Estimated Effort:** 1-2 days

---

#### 2.3 Fix Known Stability Issues ⭐ **MUST HAVE**
**Status:** Documented bugs need fixing

**Known Issues:**
- React 185 infinite loops (documented in `REACT_185_INFINITE_LOOP_FINAL_FIX.md`)
- Card view crash (disabled via env var)
- Player profile crashes (documented in `PLAYER_PROFILE_CRASH_BUG_REPORT.md`)

**Tasks:**
- [ ] Fix React 185 errors (infinite loops)
- [ ] Fix card view crash
- [ ] Fix player profile crashes
- [ ] Add comprehensive testing to prevent regressions

**Estimated Effort:** 2-3 days

---

## 🚨 Priority 3: User Experience & Performance (HIGH)

### Current Issues
- No loading skeletons (blank screens while loading)
- No client-side caching (slow navigation)
- Inconsistent loading states across pages
- No offline detection

### Required Work

#### 3.1 Loading States & Skeletons ⭐ **HIGH PRIORITY**
**Status:** Missing on most pages

**Tasks:**
- [ ] Add loading skeletons to Roster page
- [ ] Add loading skeletons to Player Profile
- [ ] Add loading skeletons to Command Center
- [ ] Show "Loading..." indicators during API calls
- [ ] Prevent layout shift during load

**Files to Create/Modify:**
- `web-next/src/components/ui/Skeleton.tsx` - Create reusable skeleton
- `web-next/src/app/simple-roster/RosterPage.tsx` - Add skeletons
- `web-next/src/app/player/[tag]/PlayerProfileClient.tsx` - Add skeletons

**Estimated Effort:** 1 day

---

#### 3.2 Client-Side Caching ⭐ **HIGH PRIORITY**
**Status:** Everything is `cache: 'no-store'`, causing slow navigation

**Tasks:**
- [ ] Implement SWR or React Query for data fetching
- [ ] Cache roster data (5-minute TTL)
- [ ] Cache player profiles (30-second TTL)
- [ ] Add stale-while-revalidate pattern
- [ ] Enable instant back/forward navigation

**Files to Modify:**
- `web-next/src/app/simple-roster/RosterPage.tsx` - Add SWR
- `web-next/src/app/player/[tag]/PlayerProfileClient.tsx` - Add SWR
- `web-next/src/app/api/v2/roster/route.ts` - Add cache headers

**Estimated Effort:** 1-2 days

---

#### 3.3 Mobile Experience Polish ⭐ **MEDIUM PRIORITY**
**Status:** Responsive but needs polish

**Tasks:**
- [ ] Optimize touch targets (minimum 44x44px)
- [ ] Improve mobile navigation (bottom bar option)
- [ ] Test on real devices (iOS, Android)
- [ ] Optimize images for mobile
- [ ] Add swipe gestures for player navigation

**Estimated Effort:** 1-2 days

---

## 🚨 Priority 4: Monitoring & Observability (HIGH)

### Current Issues
- No error tracking (Sentry)
- No performance monitoring
- No user analytics
- Limited logging

### Required Work

#### 4.1 Error Monitoring (Sentry) ⭐ **HIGH PRIORITY**
**Status:** Not implemented

**Tasks:**
- [ ] Set up Sentry account
- [ ] Install Sentry SDK
- [ ] Configure error tracking
- [ ] Set up alerts for critical errors
- [ ] Add user context to errors

**Files to Create/Modify:**
- `web-next/src/lib/monitoring/sentry.ts` - Create Sentry config
- `web-next/src/app/layout.tsx` - Initialize Sentry
- `web-next/src/components/ErrorBoundary.tsx` - Send to Sentry

**Estimated Effort:** 0.5 day

---

#### 4.2 Performance Monitoring ⭐ **MEDIUM PRIORITY**
**Status:** Not implemented

**Tasks:**
- [ ] Add Web Vitals tracking
- [ ] Monitor API response times
- [ ] Track page load times
- [ ] Set up performance budgets
- [ ] Alert on slow pages (>3s load)

**Estimated Effort:** 0.5 day

---

## 📋 Implementation Roadmap

### Week 1: Stability & Error Handling
**Days 1-2:** Fix Known Bugs
- React 185 infinite loops
- Card view crash
- Player profile crashes
- Add comprehensive testing to prevent regressions

**Days 3-4:** Error Boundaries & Recovery
- Enhanced error boundaries
- User-friendly error messages
- API retry logic
- Graceful degradation

**Day 5:** Monitoring Setup
- Sentry integration
- Error tracking
- Performance monitoring basics

---

### Week 2: Performance & UX
**Days 1-2:** Loading States & Skeletons
- Skeletons for all pages
- Loading indicators
- Prevent layout shift

**Days 3-4:** Client-Side Caching
- SWR implementation
- Cache headers
- Stale-while-revalidate
- Instant navigation

**Day 5:** Mobile Polish
- Touch target optimization
- Mobile navigation
- Device testing

---

### Week 3: Security & Privacy (Do Last)
**Days 1-2:** Privacy Audit
- Audit all endpoints for role checks
- Test as member role
- Fix any access control issues
- Document what members can see

**Days 3-5:** Real Authentication (Last Step)
- Set up Supabase Auth
- Create `/api/session` endpoint
- Replace localStorage with real auth
- Session management
- Sync user_roles with in-game roles

---

## ✅ Definition of "Member-Ready"

The dashboard is ready for member access when:

### Security ✅
- [ ] Real authentication (not localStorage)
- [ ] Members cannot access leader-only features
- [ ] Privacy boundaries verified and tested
- [ ] Session management working

### Stability ✅
- [ ] No crashes or infinite loops
- [ ] All known bugs fixed
- [ ] Error boundaries catch and handle errors gracefully
- [ ] API failures don't break the UI

### Performance ✅
- [ ] Pages load in <2 seconds
- [ ] Navigation is instant (cached)
- [ ] Loading states show progress
- [ ] Mobile experience is smooth

### Monitoring ✅
- [ ] Errors tracked in Sentry
- [ ] Performance metrics collected
- [ ] Alerts configured for critical issues

---

## 🎯 Quick Wins (Can Do Today - No Auth Required)

1. **Enhanced Error Messages** (1 hour)
   - Replace technical errors with user-friendly messages
   - Add "Retry" buttons
   - Better error boundaries

2. **Add Loading Skeletons** (2 hours)
   - Quick visual improvement
   - Better perceived performance
   - No auth changes needed

3. **Sentry Setup** (1 hour)
   - Install SDK
   - Basic error tracking
   - Monitor errors without auth

4. **Fix One Known Bug** (2-3 hours)
   - Pick easiest crash to fix
   - Immediate stability improvement

---

## 📊 Risk Assessment

### High Risk Items
- **Stability** - Known bugs could crash for members (fix first!)
- **Privacy** - Members might see sensitive data (audit before auth)
- **Authentication** - Without real auth, security is compromised (do last)

### Medium Risk Items
- **Performance** - Slow loading might frustrate members
- **Error Handling** - Poor error messages confuse users

### Low Risk Items
- **Monitoring** - Nice to have, not blocking
- **Mobile Polish** - Works, just needs refinement

---

## 🚀 Recommended Starting Point

**Start Here:** Fix Known Bugs & Error Handling (Week 1)

**Why:** 
- Prevents crashes for members
- Improves user experience immediately
- Builds trust
- No auth friction during development

**Then:** Performance & UX (Week 2)

**Why:**
- Makes it feel production-ready
- Improves perceived performance
- Better user experience

**Finally:** Security & Authentication (Week 3 - Last)

**Why:**
- Do this last to avoid development friction
- Can test everything else without auth overhead
- Once everything else works, add auth layer

---

**Next Steps:**
1. Review this plan
2. Start with Error Handling & Bug Fixes (no auth friction)
3. Then Performance & UX improvements
4. Finally add Authentication (last step, when everything else works)
5. Test as member role before opening to members

---

**Last Updated:** November 8, 2025

