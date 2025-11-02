# Feature Inventory - What We Want (Not How)

**Principle:** SSOT = Supabase. Pull once, use everywhere. Simple Architecture only.

---

## 🎯 Core Outcomes We Want

### 1. Member Intelligence & Flagging

**New Joiner Flagging**
- Flag players who joined in last 7/14/30 days
- Show "New Member" badge in roster
- Quick access to new joiner review panel
- Alerts for new joiners needing evaluation

**Churn Risk Detection**
- Identify members at risk of leaving (EI drop, donation dip, missed wars)
- "Watchlist" flagging system
- Early warning alerts for leaders
- Recovery tracking (improving after being flagged)

**Activity Status**
- Visual activity levels (Very Active, Active, Moderate, Low, Inactive)
- Activity trends over time
- Days since last activity indicator
- Inactivity alerts

**Member Departure Tracking**
- Track who left and when
- Departure reason codes
- Archive departed members
- Return player detection

---

### 2. Competitive Performance Metrics

**VIP Score** ⭐ PRIMARY METRIC (Replaced WCI)
- VIP Score is the primary metric (replaced both ACE and WCI)
- Formula: (0.50 × Competitive) + (0.30 × Support) + (0.20 × Development)
- Weekly calculation on Monday snapshots
- Leaderboard showing top performers
- Historical VIP trends (week-over-week)

**Ranked Battle Analytics**
- Tournament utilization rate (attacks used vs. available)
- Trophy efficiency per attack
- League advancement tracking
- Defense resilience scores

**War Performance**
- Attack efficiency (stars per attack)
- Contribution consistency
- War attendance reliability
- Attack quality scores (WAQ)

**League & Trophy Tracking**
- Current league tier and name
- Ranked battle trophies
- Weekly tournament cycle alignment
- Promotion/demotion tracking

---

### 3. Progression & Development Tracking

**Hero Progress**
- Current hero levels (BK, AQ, GW, RC, MP)
- Hero momentum (weekly changes)
- Engagement Index (EI) - 0-100 score
- Hero upgrade streaks
- Idle week tracking

**Base Development**
- Rush percentage calculation
- Town Hall progress
- Progression velocity tracking
- "Fast Fixer" identification (rushed but improving)

**Upgrade Tracking**
- Active upgrade indicators
- Upgrade completion ETAs
- Resource efficiency metrics
- Upgrade conflict detection (overlapping wars)

---

### 4. Clan Support & Contribution

**Donation Metrics**
- Donations given vs. received
- Donation balance (net contribution)
- Donation trends over time
- Donation ratio indicators

**Capital Raid Contribution**
- Capital raid participation
- Capital gold contributed
- District clearing efficiency
- Raid weekend participation rate

**Clan Games**
- Participation tracking
- Tier achievement
- Contribution levels

**Resource Support**
- Overall clan contribution score
- Support activity trends
- Generosity indicators

---

### 5. Leadership Tools & Insights

**Daily Briefing / Command Center**
- "What changed since last visit" feed
- Priority insights (most critical first)
- Automated alerts for key events
- Actionable recommendations

**Member Notes & Collaboration**
- Player notes with authorship
- Shared notes for leadership team
- Note history tracking
- Quick action tags (coach, watchlist, etc.)

**Applicant Evaluation**
- Applicant scoring system
- Rush detection for applicants
- Sandbagger alerts
- Recruitment decision support

**CWL Squad Builder**
- Ideal 15/30 squad suggestions
- Based on WCI, WAQ, EI, TH distribution
- Hero availability consideration
- Upgrade conflict avoidance

**War Readiness**
- Hero availability tracking
- Upgrade conflict detection
- War attendance reliability
- Ready vs. not-ready indicators

---

### 6. Historical Analysis & Trends

**Trend Visualization**
- Sparklines for key metrics (trophies, donations, EI)
- Week-over-week comparisons
- Monthly trend charts
- Performance momentum indicators

**Change Tracking**
- What changed since last snapshot
- Snapshot comparisons
- Historical change logs
- Member evolution tracking

**Performance History**
- Historical WCI scores
- War performance trends (30/60/90 day windows)
- Donation trend analysis
- Capital progress tracking

---

### 7. Data Quality & Reliability

**Snapshot Management**
- Last snapshot timestamp display
- Data freshness indicators
- Snapshot comparison tools
- Ingestion health monitoring

**Data Validation**
- Missing data detection
- Inconsistent data flagging
- Data quality scores
- Error reporting

---

## 📊 Metrics We Want to Display

### Primary Metrics (Always Visible)
- **WCI Score** (0-100) - Weekly Competitive Index
- **Activity Level** (Badge: Very Active → Inactive)
- **Rush %** (Color-coded: Green/Yellow/Red)
- **League Tier** (Ranked battle league)
- **Ranked Trophies** (Current week)

### Secondary Metrics (On Hover/Details)
- **EI Score** (0-100) - Engagement Index
- **Donation Balance** (Net contribution)
- **War Attendance** (Reliability score)
- **Hero Levels** (BK, AQ, GW, RC, MP)
- **Tenure** (Days in clan)

### Historical Metrics (Trends)
- **WCI Trend** (Up/Down/Stable over 4-8 weeks)
- **Activity Trend** (Improving/Declining)
- **Hero Momentum** (Weekly hero level changes)
- **Donation Trend** (Over time)

---

## 🎨 UI Features We Want

### Roster View
- Sortable columns (WCI, Activity, Rush%, League, Trophies, etc.)
- Filterable by TH level, role, activity status
- Color-coded indicators (rush %, activity, new joiner flags)
- Mobile-responsive card view
- Quick actions (view profile, add note, flag)

### Player Profile
- Comprehensive player stats
- Historical trend charts
- WCI breakdown (CP vs PS components)
- Notes and leadership comments
- Upgrade tracking
- Performance history

### Leadership Dashboard
- New joiner review panel
- Watchlist members
- Daily briefing
- War readiness board
- CWL squad builder
- Member notes management

### Change Dashboard
- "What changed" feed
- Snapshot comparisons
- Change history
- Departure tracking

---

## 🔔 Alerts & Notifications We Want

### Automated Alerts
- New joiner alerts
- Churn risk warnings (EI drop, activity decline)
- War readiness conflicts (upgrade during war)
- Departure notifications
- Major metric changes (WCI drop, activity drop)

### Leader-Focused Alerts
- Member needing attention (watchlist, low activity)
- Upgrade opportunities (fast fixers improving)
- Recognition opportunities (high performers)
- Action items (applicants to review)

---

## 🚫 What We DON'T Want

- Complex state management (no Zustand complexity)
- Multiple data sources (SSOT = Supabase only)
- Duplicate implementations (one way to do everything)
- Obsolete metrics (ACE and WCI replaced by VIP Score)
- Broken/unused features (clean house)
- Architecture confusion (Simple Architecture only)

---

## ✅ Implementation Principles

1. **SSOT = Supabase**
   - All data comes from Supabase
   - Pull once, cache, use everywhere
   - No client-side state management complexity

2. **Simple Architecture**
   - Backend-driven data flow
   - Frontend is presentational
   - Direct API calls, simple useState/useEffect

3. **Feature-First**
   - Focus on outcomes, not implementation details
   - Build incrementally on stable foundation
   - Test each feature independently

4. **Clean Codebase**
   - No obsolete code
   - No duplicate implementations
   - Clear, maintainable code

---

**This is our feature wishlist. Now we implement using Simple Architecture.**

