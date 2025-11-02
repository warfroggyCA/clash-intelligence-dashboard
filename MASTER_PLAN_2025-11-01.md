# Clash Intelligence Dashboard - Master Plan
**Date:** November 1, 2025  
**Status:** Active Development  
**Architecture:** Simple Architecture (Backend-Driven, Presentational Frontend)

---

## 🎯 Current State (November 2025)

### ✅ **What's Working & Production-Ready**

#### **1. Simple Architecture Dashboard**
- **Roster Page** (`/simple-roster`) - Primary dashboard
  - ✅ Clean, fast, zero React errors
  - ✅ Sortable columns (League, Trophies, TH, Donations, etc.)
  - ✅ VIP Score display with trend indicators
  - ✅ Rush % calculation and color coding
  - ✅ Activity badges
  - ✅ Hero levels display
  - ✅ Mobile-responsive (table → cards)
  - ✅ Auto-refresh on stale data detection
  - ✅ Real player names from Supabase
  - ✅ Export functionality (CSV, Discord, Copy Summary)
  - ✅ Roster summary cards (VIP average, new joiners, activity breakdown)
  - ✅ New joiner flagging (badges and detection)
  - ✅ Scroll indicator for horizontal overflow

- **Player Profile** (`/player/[tag]`)
  - ✅ Clean player detail view
  - ✅ VIP Score history and breakdown
  - ✅ Hero progression tracking
  - ✅ Donation statistics
  - ✅ League and trophy history
  - ✅ Historical charts (Trophy, Donation, Hero progression)
  - ✅ Comprehensive copy summary (detailed data for LLM analysis)

#### **2. Data Pipeline**
- **Automated Ingestion**
  - ✅ Two daily cron jobs: 4:30 AM UTC and 5:30 AM UTC
  - ✅ Staged pipeline: fetch → transform → upsert → writeSnapshot → writeStats
  - ✅ Writes to `canonical_member_snapshots` for API consumption
  - ✅ Writes to `member_snapshot_stats` for detailed metrics
  - ✅ Idempotent operations (safe to rerun)

- **VIP Score Calculation**
  - ✅ Weekly calculation on Monday snapshots
  - ✅ Formula: `(0.50 × Competitive) + (0.30 × Support) + (0.20 × Development)`
  - ✅ Components: Ranked (LAI, TPG) + War (OVA, DVA) + Support + Development
  - ✅ Historical tracking for trends

- **Data Freshness**
  - ✅ Dashboard auto-detects stale data (`today > snapshotDate`)
  - ✅ Auto-refresh with cooldown (prevents infinite loops)
  - ✅ API returns `dateInfo` with staleness flag

#### **3. Backend Infrastructure**
- **API Endpoints**
  - ✅ `/api/v2/roster` - Roster data with VIP scores
  - ✅ `/api/v2/player/[tag]` - Player profile data
  - ✅ `/api/cron/daily-ingestion` - Cron job endpoint
  - ✅ `/api/admin/cron-status` - Monitoring endpoint

- **Database (Supabase)**
  - ✅ `canonical_member_snapshots` - Primary data source for API
  - ✅ `member_snapshot_stats` - Detailed snapshots
  - ✅ `vip_scores` - Weekly VIP calculations
  - ✅ `members` - Player registry
  - ✅ `roster_snapshots` - Snapshot metadata

---

## 🏗️ Architecture Philosophy

### **Simple Architecture Principles**

1. **Backend-Driven**: All calculations and data processing happen server-side
2. **Presentational Frontend**: Frontend only fetches and displays
3. **Direct API Calls**: No complex state management (no Zustand)
4. **Simple State**: Use `useState` and `useEffect` only
5. **No Memoization Hell**: Avoid `useMemo` with unstable dependencies

### **Data Flow**

```
CoC API → Staged Pipeline → Supabase → API Endpoints → Frontend Display
```

**Key Point**: SSOT (Single Source of Truth) is Supabase. Pull once, use everywhere.

---

## 📋 What's Next (Priority Order)

### **Phase 1: Core Features (Current Focus)**

#### **1.1 Enhanced Roster Features**
- [ ] **Search/Filter Functionality**
  - Search by player name or tag
  - Filter by TH level, role, activity level
  - Filter by VIP score range

- [x] **Export Options** ✅ **COMPLETE**
  - ✅ Export roster to CSV
  - ✅ Export roster to Discord format
  - ✅ Copy summary to clipboard

- [x] **Roster Summary Cards** ✅ **COMPLETE**
  - ✅ Total members, average VIP score
  - ✅ New joiners count
  - ✅ Activity breakdown (Very Active, Active, Moderate, Low, Inactive)

#### **1.2 Player Profile Enhancements**
- [x] **Historical Charts** ✅ **COMPLETE**
  - ✅ Trophy progression graph (regular + ranked)
  - ✅ Donation history (given vs received)
  - ✅ Hero upgrade timeline (BK, AQ, GW, RC)
  - ⏳ VIP Score trend over time (partial - data available, chart pending)

- [ ] **Comparison Views**
  - Compare player to clan average
  - Compare to same TH level
  - Compare to same league tier

#### **1.3 Leadership Tools**
- [x] **New Joiner Flagging** ✅ **COMPLETE**
  - ✅ Automatic detection of new members (isNewJoiner function)
  - ✅ Flag players who joined in last 7 days (badge in roster)
  - ✅ Show tenure days prominently (displayed in roster table)

- [ ] **Activity Alerts**
  - ⏳ Flag inactive players (alerts engine exists, needs UI integration)
  - [ ] Alert on sudden VIP score drops
  - [ ] Notify on rushed base improvements

### **Phase 2: Advanced Analytics (Future)**

#### **2.1 War Analytics**
- [ ] War readiness scoring
- [ ] Attack quality metrics
- [ ] Defense resilience tracking
- [ ] War participation tracking

#### **2.2 Clan Health Metrics**
- [ ] Overall clan activity score
- [ ] Donation health index
- [ ] Progression velocity tracking
- [ ] Competitive participation rate

#### **2.3 Predictive Insights**
- [ ] Burnout prediction (declining activity)
- [ ] Departure risk scoring
- [ ] Growth potential identification
- [ ] Recruitment recommendations

### **Phase 3: User Experience (Polish)**

#### **3.1 UI/UX Improvements**
- [ ] Loading skeletons (better perceived performance)
- [ ] Error boundaries (graceful failures)
- [x] Toast notifications (for actions) ✅ **COMPLETE** - Using showToast utility
- [ ] Keyboard shortcuts
- [x] Dark mode toggle ✅ **COMPLETE** - Dark theme implemented

#### **3.2 Mobile Optimization**
- [ ] Swipe gestures for navigation
- [ ] Bottom navigation bar option
- [ ] Optimized touch targets
- [ ] Offline support (service worker)

#### **3.3 Performance**
- [ ] Client-side caching (SWR or React Query)
- [ ] Image optimization
- [ ] Code splitting
- [ ] Bundle size optimization

---

## 🔧 Technical Implementation Details

### **VIP Score Components**

**Competitive Performance (50%):**
- Ranked (60%): LAI (70%) + TPG (30%)
- War (40%): OVA (60%) + DVA (40%)

**Support Performance (30%):**
- Donations (60%): Small-clan friendly calculation
- Capital (40%): Week-over-week delta

**Development Performance (20%):**
- Base Quality (40%): PDR (100 - rush%)
- Activity (30%): Capital + Achievement + War participation
- Hero Progression (30%): Week-over-week hero upgrades

### **Stale Data Detection**

```typescript
// API returns dateInfo
{
  currentDate: "2025-11-01",
  snapshotDate: "2025-10-31",
  isStale: true  // currentDate > snapshotDate
}

// Frontend auto-refreshes if stale
if (dateInfo.isStale && !staleCheckRef.current) {
  setRefreshTrigger(prev => prev + 1);
}
```

### **Cron Job Schedule**

```
4:30 AM UTC - First daily ingestion
5:30 AM UTC - Second daily ingestion
```

Both jobs:
- Fetch from CoC API
- Transform and validate data
- Write to `canonical_member_snapshots`
- Write to `member_snapshot_stats`
- Calculate VIP scores (on Mondays)

---

## 🚫 What We're NOT Doing

### **Deprecated/Removed**
- ❌ Complex Zustand state management
- ❌ Dual architecture (simple + complex) - **COMPLETE:** Simple architecture is now primary
- ❌ Command Rail (disabled placeholder) - **REMOVED:** Component disabled, CSS remnants may exist
- ❌ QuickActions bar (moved to header menu) - **COMPLETE:** Moved to Actions menu in header
- ❌ Card view toggle (auto-responsive instead) - **COMPLETE:** Auto-responsive design
- ❌ WCI Score (replaced by VIP Score) - **COMPLETE:** VIP is primary metric, WCI code exists but unused
- ❌ ClientDashboard (old complex dashboard) - **DEPRECATED:** File exists but unused; main route uses SimpleRosterPage

### **Not Planned**
- ❌ Real-time WebSocket updates (polling is sufficient)
- ❌ Complex memoization patterns
- ❌ Multi-clan management (single clan focus)
- ❌ Custom dashboard builder
- ❌ Advanced AI features (keep it simple)

---

## 📊 Success Metrics

### **Technical Metrics**
- ✅ Zero React 185 errors
- ✅ Zero infinite loop crashes
- ✅ < 2 second page load time
- ✅ 100% API endpoint uptime
- ✅ Daily cron job success rate > 95%

### **User Experience Metrics**
- ✅ Fresh data always available
- ✅ Smooth navigation (no crashes)
- ✅ Mobile-responsive design
- ✅ Intuitive interface
- ✅ Fast feature additions

### **Data Quality Metrics**
- ✅ Accurate VIP scores
- ✅ Complete player data
- ✅ Historical tracking
- ✅ Reliable ingestion

---

## 🗂️ File Structure

### **Key Files**

**Frontend:**
- `web-next/src/app/simple-roster/RosterPage.tsx` - Main roster table
- `web-next/src/app/player/[tag]/PlayerProfileClient.tsx` - Player profile
- `web-next/src/app/simple-roster/roster-transform.ts` - API response transformer

**Backend:**
- `web-next/src/app/api/v2/roster/route.ts` - Roster API endpoint
- `web-next/src/app/api/v2/player/[tag]/profile/route.ts` - Player API endpoint
- `web-next/src/app/api/cron/daily-ingestion/route.ts` - Cron job handler

**Data Pipeline:**
- `web-next/src/lib/ingestion/staged-pipeline.ts` - Main ingestion pipeline
- `web-next/src/lib/ingestion/calculate-vip.ts` - VIP score calculation
- `web-next/src/lib/metrics/vip.ts` - VIP score formulas

**Database:**
- `supabase/migrations/20250131_create_vip_scores.sql` - VIP scores table
- `supabase/migrations/*` - Other schema migrations

---

## 🎯 Next Immediate Actions

### **This Week**
1. ✅ Verify canonical snapshots are writing correctly
2. ✅ Confirm stale data detection works
3. ✅ Test VIP score display on roster and player pages

### **Next Week**
1. Add search/filter to roster table
2. ~~Add export functionality~~ ✅ **DONE**
3. ~~Add new joiner flagging~~ ✅ **DONE**

### **Following Weeks**
1. ~~Historical charts for player profiles~~ ✅ **DONE** (Trophy, Donation, Hero charts)
2. ~~Roster summary cards~~ ✅ **DONE**
3. Activity alerts (UI integration needed)

---

## 📚 Related Documentation

- `VIP_SCORE_SPECIFICATION.md` - Complete VIP score formula documentation
- `SIMPLE_REBUILD_PLAN.md` - Original simple architecture plan
- `SIMPLE_ARCHITECTURE_CHANGELOG.md` - Implementation history
- `VIP_IMPLEMENTATION_SUMMARY.md` - VIP score implementation details

---

## 🔑 Key Principles

1. **Simplicity First**: If it's complex, simplify it
2. **Backend Does Work**: Frontend displays only
3. **SSOT is Supabase**: Pull once, use everywhere
4. **Incremental Features**: Add one thing at a time
5. **Test Thoroughly**: Every feature works before moving on

---

**Last Updated:** January 25, 2025  
**Status:** Active Development  
**Architecture:** Simple Architecture ✅

