# Viral CoC Analytics Features - Analysis & Recommendations
**Date:** January 25, 2025
**Source:** External article on viral CoC analytics features

## 📊 Current State Assessment

### ✅ What We Already Have

**Historical Tracking:**
- ✅ Daily snapshots stored in `canonical_member_snapshots` and `member_snapshot_stats`
- ✅ Player history API (`/api/player/[tag]/history`) with trophy/donation/hero trends
- ✅ Historical charts: Trophy progression, Donation history, Hero upgrade timeline
- ✅ VIP Score trends (weekly calculations stored)
- ✅ Activity tracking with multi-indicator system

**Social Comparison:**
- ✅ VIP Score leaderboard on roster page
- ✅ Sortable roster table (multiple dimensions)
- ⏳ Comparison views (planned but not implemented)

**Insights:**
- ✅ Rush percentage calculation
- ✅ Activity scoring (Very Active, Active, Moderate, Low, Inactive)
- ✅ Donation balance tracking
- ✅ Hero progression tracking
- ✅ Comprehensive player summary (copy feature)

### ⚠️ Partially Implemented

**War Analytics:**
- ⏳ War log API available (`/clans/{tag}/warlog`) but not ingested yet
- ⏳ Current war data available but not tracked historically
- ⏳ War participation visible but not analyzed

**Predictive Features:**
- ⏳ Historical data exists but predictions not implemented
- ⏳ Activity trends visible but not used for predictions

---

## 🎯 Article Features vs. Our Capabilities

### ✅ Fully Doable (High Priority)

#### 1. **Performance Evolution & Historical Tracking**
**Status:** 70% Complete - We have foundation, need enhancement

**What We Can Do:**
- ✅ Trophy time-series (regular + ranked) - **Already implemented**
- ✅ Donation history - **Already implemented**
- ✅ Hero progression timeline - **Already implemented**
- ✅ War stars tracking - **Data available, not visualized**
- ✅ Loot collected - **NOT in API** (not trackable)
- ✅ Attack success rates - **NOT directly in API** (can infer from war data)
- ✅ Personal best streaks - **Easy to calculate from historical data**
- ✅ Milestone tracking - **Easy to add**

**Gap:** Need to add:
- War performance month-over-month trends
- Streak tracking (login, donation, war participation)
- Milestone celebration cards
- "Best week/month" highlights

**API Data Available:** ✅ Yes - All needed data exists

---

#### 2. **War Performance Analytics** ⭐ HIGH VALUE
**Status:** 20% Complete - API available but not ingested

**What We Can Do:**
- ✅ Track war results by month - **API: `/clans/{tag}/warlog`**
- ✅ Star efficiency rates - **Calculate from war log**
- ✅ Destruction percentages - **In war log**
- ✅ Attack timing patterns - **Timestamps in war log**
- ✅ TH level matchups (who they beat/lost to) - **In war log**
- ✅ "Clutch factor" (late-war deciding attacks) - **Calculate from timestamps**

**Gap:** Need war ingestion pipeline:
- Ingest `/clans/{tag}/warlog` daily
- Store in `clan_wars`, `clan_war_members`, `clan_war_attacks` tables
- Build war analytics dashboard

**API Data Available:** ✅ Yes - Full war log available (100+ wars)

**Recommendation:** ⭐ **HIGH PRIORITY** - This is highly requested and we have all data

---

#### 3. **Seasonal Comparison Dashboard**
**Status:** 30% Complete - Snapshots exist but comparison not built

**What We Can Do:**
- ✅ Compare donations given/received - **Data available**
- ✅ Trophy gains/losses - **Data available**
- ✅ Capital contributions - **Data available**
- ✅ Clan games points - **NOT in API** (can't track)
- ✅ Raid weekend performance - **API available: `/clans/{tag}/capitalraidseasons`**
- ✅ Visual comparison cards - **Need to build UI**

**Gap:** Need to:
- Calculate season boundaries (match CoC seasons)
- Build comparison UI showing current vs previous season
- Highlight improvement areas
- Celebration badges for wins

**API Data Available:** ✅ Mostly - Missing clan games data only

---

#### 4. **Clan Member Leaderboards**
**Status:** 60% Complete - Basic leaderboard exists, need enhancement

**What We Can Do:**
- ✅ Multiple dimension rankings - **Sortable table exists**
- ✅ Donation ratio leaderboard - **Can calculate**
- ✅ War performance ranking - **Need war data ingested**
- ✅ Trophy gain rate - **Data available**
- ✅ Activity consistency - **Already calculated**
- ✅ Clan games contributions - **NOT in API**

**Gap:** Need dynamic leaderboard component:
- Multi-criteria sorting/ranking
- "Your rank" indicators
- Visual badges for top performers
- Historical rank tracking

**API Data Available:** ✅ Yes - All needed data exists

---

#### 5. **Percentile Rankings & Global Context**
**Status:** 10% Complete - Local rankings only

**What We Can Do:**
- ✅ Clan percentile rankings - **Easy to calculate** (top 25%, etc.)
- ⚠️ Global percentile - **Limited**: API only provides top 200 rankings
- ✅ TH-specific comparisons - **Can calculate within clan**
- ✅ League tier context - **Have league data**

**Gap:** Global percentiles require:
- Either: Estimates based on known distributions
- Or: Integration with third-party data sources
- Or: Focus on clan-relative percentiles only

**API Data Available:** ⚠️ Partial - Top 200 only, not full distribution

**Recommendation:** Focus on **clan-relative percentiles** (more actionable anyway)

---

#### 6. **Head-to-Head Comparisons**
**Status:** 0% Complete - Not implemented

**What We Can Do:**
- ✅ Side-by-side stats comparison - **All data available**
- ✅ Multi-dimensional comparison (trophies, donations, war, etc.)
- ✅ Visual comparison cards - **Need UI**
- ✅ "Rivalry tracker" - **Easy to add**

**Gap:** Need comparison UI component:
- Select two players
- Display side-by-side metrics
- Highlight who's better at what
- Track comparison history

**API Data Available:** ✅ Yes - All needed data exists

**Recommendation:** ⭐ **MEDIUM PRIORITY** - High engagement feature, relatively easy

---

#### 7. **Upgrade Optimization Calculator**
**Status:** 0% Complete - Not implemented

**What We Can Do:**
- ✅ Show current upgrade paths - **Have hero/upgrade data**
- ✅ Calculate time to max TH - **Can estimate from current progress**
- ✅ Builder queue optimization - **NOT in API** (can't see current builders)
- ✅ Lab queue optimization - **NOT in API** (can't see current research)
- ✅ Style-based recommendations (war vs farming) - **Can infer from activity**

**Gap:** API limitations:
- Can't see active upgrades (builders/research)
- Can only see completed levels
- Can estimate optimal paths but not current state

**API Data Available:** ⚠️ Partial - Missing active upgrade state

**Recommendation:** Focus on **"what should I upgrade next"** recommendations rather than queue optimization

---

#### 8. **Performance Prediction Model**
**Status:** 20% Complete - Historical data exists but predictions not built

**What We Can Do:**
- ✅ Predict trophy progression - **Can extrapolate from trends**
- ✅ Predict donation totals - **Can extrapolate from velocity**
- ✅ Predict upgrade completion - **Can estimate from progress rate**
- ⚠️ CWL promotion probability - **Need war league data**

**Gap:** Need prediction algorithms:
- Linear/trend extrapolation
- Confidence intervals
- Visual "projection" lines on charts

**API Data Available:** ✅ Yes - Historical data sufficient for basic predictions

**Recommendation:** ⭐ **MEDIUM PRIORITY** - Differentiating feature

---

#### 9. **Activity Consistency Scoring**
**Status:** 80% Complete - Already implemented, just need enhancement

**What We Can Do:**
- ✅ Login frequency tracking - **Already doing via snapshots**
- ✅ Attack regularity - **Can infer from trophy changes**
- ✅ War participation rates - **Data available, need to track**
- ✅ Badges (casual/regular/dedicated/hardcore) - **Can add**
- ✅ Commitment level visualization - **Can enhance**

**Gap:** Just need to:
- Add badge system
- Visual commitment level indicators
- Consistency scoring algorithm refinement

**API Data Available:** ✅ Yes - All needed data exists

---

#### 10. **Streak Tracking**
**Status:** 0% Complete - Not implemented but easy

**What We Can Do:**
- ✅ War attack streaks - **Calculate from war log**
- ✅ Daily login streaks - **Calculate from snapshot frequency**
- ✅ Donation streaks - **Calculate from donation deltas**
- ✅ Visual streak indicators - **Need UI**
- ✅ Streak break notifications - **Can add**

**Gap:** Need streak calculation:
- Daily snapshot analysis
- Streak counter component
- Notification system

**API Data Available:** ✅ Yes - Historical data sufficient

**Recommendation:** ⭐ **HIGH PRIORITY** - High engagement, relatively easy

---

### ⚠️ Partially Doable (Medium Priority)

#### 11. **True Donation Impact Metrics**
**Status:** 30% Complete - Basic donation tracking exists

**What We Can Do:**
- ⚠️ Average troop level donated - **NOT in API** (can't see what was donated)
- ⚠️ Fulfillment speed - **NOT in API** (no timestamps for requests)
- ⚠️ Most-requested troops - **NOT in API**
- ✅ Donation velocity (trends over time) - **Can calculate**
- ✅ "Value added to clan" scores - **Can calculate from ratios**

**Gap:** API limitations mean we can only track:
- Total donations given/received
- Donation ratios
- Donation trends

**API Data Available:** ⚠️ Limited - Only totals, not details

**Recommendation:** Focus on what we CAN track (velocity, ratios, trends)

---

#### 12. **Clan Loyalty & History Tracker**
**Status:** 40% Complete - Can detect changes but not full history

**What We Can Do:**
- ✅ Detect clan changes - **Can see from snapshot deltas**
- ✅ Time spent in current clan - **Tenure tracking exists**
- ✅ Role achieved - **Track role changes**
- ⚠️ Previous clans - **NOT in API** (no historical clan list)
- ⚠️ Reason for leaving - **Can't determine** (no API data)

**Gap:** API limitations:
- No historical clan membership data
- Can only track current clan tenure
- Can detect when someone leaves but not where they went

**API Data Available:** ⚠️ Limited - Current clan only

**Recommendation:** Track what we can (current clan tenure, role progression)

---

### ❌ Not Doable (API Limitations)

#### 13. **War Attack Heat Maps**
**Status:** ❌ Not Possible

**Why:** API doesn't provide:
- Attack coordinates
- Base layout data
- Attack path data

**Alternative:** Can track attack success rates by:
- Target TH level
- Attack timing
- Star efficiency
- But not visual heat maps

---

#### 14. **Global Percentile Rankings**
**Status:** ⚠️ Partially Possible

**Why:** API only provides:
- Top 200 rankings per category
- Not full player distribution

**Alternative:** 
- Focus on clan-relative percentiles (more actionable)
- Use TH-level comparisons within clan
- Estimate global percentiles based on known thresholds

---

#### 15. **Real-Time War Dashboard**
**Status:** ⚠️ Partially Possible

**What We Can Do:**
- ✅ Get current war status - **API: `/clans/{tag}/currentwar`**
- ✅ Show remaining attacks - **In war data**
- ✅ Calculate win probability - **Can estimate from historical performance**
- ❌ Real-time updates - **API rate limits prevent live polling**
- ⚠️ Historical performance of remaining attackers - **Need war history ingested**

**Gap:** 
- Can't poll frequently enough for "real-time"
- But can show current state and probability estimates

**API Data Available:** ✅ Yes - But rate limits prevent true real-time

---

### 🎨 Shareable Features (Viral Potential)

#### 16. **Achievement Milestone Cards**
**Status:** 0% Complete - Not implemented

**What We Can Do:**
- ✅ Auto-generate milestone graphics - **All data available**
- ✅ "10,000th donation!" - **Easy to detect**
- ✅ "100 war stars!" - **Easy to detect**
- ✅ "1,000 days playing" - **Can calculate from tenure**
- ✅ Instagram/Discord-ready graphics - **Need design/implementation**

**Gap:** Need:
- Milestone detection logic
- Graphic generation (canva-style API or image generation)
- Share functionality

**API Data Available:** ✅ Yes - All needed data exists

**Recommendation:** ⭐ **HIGH PRIORITY** - Viral potential, relatively easy

---

#### 17. **Progress Video Time-Lapses**
**Status:** 0% Complete - Not implemented

**What We Can Do:**
- ✅ Animate base progression - **Historical data exists**
- ✅ Trophy climbs - **Chart data available**
- ✅ Stat increases - **All tracked**
- ⚠️ Video generation - **Need animation library**

**Gap:** Need:
- Animation library (D3, Chart.js, or video generation)
- Timeline scrubbing UI
- Export functionality

**API Data Available:** ✅ Yes - Historical data sufficient

**Recommendation:** ⭐ **MEDIUM PRIORITY** - High viral potential but more complex

---

#### 18. **Clan Report Cards**
**Status:** 20% Complete - Basic summary exists

**What We Can Do:**
- ✅ Top performers - **VIP scores available**
- ✅ Biggest improvers - **Can calculate from deltas**
- ✅ Activity alerts - **Already have activity scoring**
- ✅ Shareable format - **Can generate PDF/image**

**Gap:** Need:
- Report card template design
- Automated generation
- Weekly/monthly scheduling
- Share functionality

**API Data Available:** ✅ Yes - All needed data exists

**Recommendation:** ⭐ **HIGH PRIORITY** - Leaders love this, shareable content

---

#### 19. **Personal "Wrapped" Annual Reports**
**Status:** 0% Complete - Not implemented

**What We Can Do:**
- ✅ Total attacks - **Can calculate from war log**
- ✅ Favorite troops - **NOT in API** (can't see attack compositions)
- ✅ Biggest victories - **Can identify from war log**
- ✅ Clan contributions - **All tracked**
- ✅ Year-over-year comparison - **Historical data exists**

**Gap:** Need:
- Annual summary calculation
- Beautiful report design
- Spotify-style layout
- Share functionality

**API Data Available:** ⚠️ Mostly - Missing attack composition details

**Recommendation:** ⭐ **MEDIUM PRIORITY** - High viral potential

---

## 🎯 Prioritized Recommendations

### Tier 1: Quick Wins (High Impact, Low Effort)
1. **Streak Tracking** - Easy calculation from existing data
2. **Achievement Milestone Cards** - Auto-detect + share graphics
3. **Enhanced Leaderboards** - Multi-criteria rankings
4. **Head-to-Head Comparisons** - Side-by-side player comparison

### Tier 2: High Value Features (Medium Effort)
1. **War Performance Analytics** - Need ingestion pipeline but high demand
2. **Performance Predictions** - Trend extrapolation on existing charts
3. **Clan Report Cards** - Weekly/monthly automated summaries
4. **Seasonal Comparisons** - Current vs previous season dashboard

### Tier 3: Viral Features (Higher Effort, High Potential)
1. **Progress Time-Lapses** - Animated progression videos
2. **Personal "Wrapped" Reports** - Annual summaries
3. **Upgrade Recommendations** - AI-powered suggestions

### Tier 4: Nice to Have (Lower Priority)
1. **Global Percentile Rankings** - Limited by API
2. **Donation Quality Metrics** - Limited by API
3. **Real-Time War Dashboard** - Rate limit constraints

---

## 📝 Action Items to Add to Master Plan

### Immediate Additions (Phase 1.5):

1. **War Analytics Pipeline** ⭐
   - Ingest `/clans/{tag}/warlog` daily
   - Store war data in Supabase
   - Build war performance dashboard
   - Track attack efficiency, star rates, clutch factor

2. **Streak Tracking System** ⭐
   - Calculate login streaks from snapshots
   - Calculate donation streaks from deltas
   - Calculate war participation streaks
   - Visual streak indicators on roster/profile

3. **Milestone Detection & Celebration** ⭐
   - Auto-detect major milestones (donations, war stars, tenure)
   - Generate shareable milestone cards
   - Celebration notifications
   - Social sharing integration

4. **Enhanced Leaderboards**
   - Multi-criteria rankings (donation ratio, war performance, etc.)
   - "Your rank" indicators
   - Historical rank tracking
   - Top performer badges

### Medium-Term Additions (Phase 2):

5. **Head-to-Head Player Comparison**
   - Side-by-side comparison UI
   - Multi-metric comparison
   - Rivalry tracking

6. **Performance Predictions**
   - Trend extrapolation on charts
   - "Projected" lines showing future trajectory
   - Confidence intervals
   - Goal tracking ("On track to reach X in Y days")

7. **Seasonal Comparison Dashboard**
   - Current vs previous season stats
   - Improvement highlighting
   - Celebration badges for wins

8. **Clan Report Cards**
   - Weekly/monthly automated summaries
   - Top performers, biggest improvers
   - Activity alerts
   - Shareable PDF/image format

### Long-Term Additions (Phase 3):

9. **Progress Time-Lapse Videos**
   - Animated base progression
   - Trophy climb animations
   - Shareable video exports

10. **Personal "Wrapped" Annual Reports**
    - Year-end summaries
    - Biggest victories, contributions
    - Year-over-year comparisons
    - Shareable format

11. **Upgrade Optimization Recommendations**
    - AI-powered upgrade suggestions
    - Style-based paths (war vs farming)
    - Time-to-max predictions

---

## 🔑 Key Insights

**What We're Strong At:**
- Historical data collection (daily snapshots)
- Time-series tracking (trophies, donations, heroes)
- Activity scoring and consistency tracking
- VIP Score calculation and trends

**What We Need to Build:**
- War data ingestion and analytics
- Social comparison features (leaderboards, head-to-head)
- Shareable content generation (milestones, report cards)
- Predictive analytics (trend extrapolation, goal tracking)

**API Limitations to Work Around:**
- Can't see active upgrades (builders/research queues)
- Can't see donation details (troop levels, fulfillment speed)
- Can't see attack compositions (favorite troops)
- Global percentiles limited (top 200 only)
- No historical clan membership data

**Strategic Focus:**
The article emphasizes **social comparison** and **shareable achievements** as viral drivers. We should prioritize:
1. Leaderboards and rankings (social comparison)
2. Milestone celebrations (shareable content)
3. War analytics (highly requested, we have the data)
4. Streaks and consistency (engagement hooks)

These align perfectly with our existing data infrastructure and can be built incrementally on our simple architecture foundation.

