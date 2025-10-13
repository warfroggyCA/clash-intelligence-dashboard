# Activity Metrics and Advanced Reporting Ideas

**Date Created**: 2025-10-13  
**Status**: Strategic Planning Document  
**Priority**: High - Foundation for Next Phase Development

---

## Executive Summary

The comprehensive documentation provided in `COC_API_MASTER_INDEX.md` and `COC_API_QUICK_REFERENCE.md`, alongside the real-world data in `COC_API_REAL_DATA_EXAMPLES.json`, confirms that the Clash of Clans API offers extensive, granular data points but notably lacks an explicit timestamp for a player's last login or a direct "active/inactive" flag.

To provide the clan leaders and co-leaders who use the Clash Intelligence dashboard with actionable insights, the solution involves creating **derived metrics** that combine snapshot data (which updates quickly, often real-time or near real-time) over time.

Below are groundbreaking reporting ideas for the dashboard and highly effective proxies for determining activity level, synthesizing the raw API data capabilities with the application's stated goals.

---

## I. Incredibly Useful Proxies for Determining Activity Level

Since the API doesn't offer a direct last-login timestamp, activity must be inferred from the metrics that update *frequently* and require direct player interaction. The most useful proxies rely on detecting changes between stored roster snapshots (`member_snapshot_stats` or `roster_snapshots`).

| Proxy Metric | Source Data Field(s) | Activity Indicated | Update Frequency Consideration |
| :--- | :--- | :--- | :--- |
| **1. Primary: Donation Velocity (DV)** | `donations`, `donationsReceived` | Basic daily engagement, supporting clanmates. | Real-time. Tracking the delta between subsequent snapshots (e.g., hourly/daily fetch) provides the most reliable short-term activity signal. |
| **2. Home Village PvP Interaction Index** | `trophies`, `attackWins`, `defenseWins`, `bestTrophies` | Active raiding (offense) and base monitoring (defense). | Trophies update real-time. Attack/Defense wins are cumulative on the player profile. Tracking the *daily change* in these counts is key. |
| **3. Builder Base Engagement** | `versusTrophies`, `builderBaseTrophies`, `bestBuilderBaseTrophies` | Engagement in the secondary, time-consuming game mode. | Trophies update real-time. Movement here suggests a player logged in specifically to participate in Builder Base battles. |
| **4. Event Participation Proxy** | `clanCapitalContributions`; `achievements` -> `Games Champion` / `Well Seasoned` | Commitment to cyclical/seasonal events. | Capital raids and Clan Games update in real-time during the event window. Tracking contributions/points during the live event window (e.g., Friday-Monday for Capital) indicates mandatory activity. |
| **5. Low-TH Trophy Decay/Movement** | `trophies`, `league.name` | Logged in recently enough to either push or lose trophies. For unranked members (like Sirojiddin, rank 7, with 0 trophies), simply gaining *any* trophy count is proof of activity. | Real-time tracking of trophy decay/gain is vital for low-activity members. The current league membership itself (e.g., Unranked) can flag a lack of recent dedicated PvP activity. |

### The Groundbreaking Activity Proxy: The ACE Availability Multiplier Enhancement

The existing design includes an ACE Score (All-Mode Clan Excellence) with an "availability multiplier". This multiplier can be dramatically enhanced by combining the above proxies, leading to a truly definitive metric:

**Enhanced Proxy: Weighted Activity Score (WAS)**

This metric calculates a weighted, rolling average of player interaction across all four major modes over the last 7 days (or between snapshots, leveraging the high frequency of data updates).

```
WAS = w₁(ΔDonations) + w₂(ΔTrophyWins) + w₃(ΔCapitalContrib) + w₄(ΔSeasonPoints)
```

This score should be measured against the player's potential, factoring in their Town Hall level (`townHallLevel`) and role (`role`) (e.g., a leader's score weighs higher on donations and capital contribution).

This system moves beyond measuring performance (ACE) to quantify **login and interaction consistency**, providing the missing "activity" context for the Roster table.

---

## II. Definitive and Groundbreaking Reporting Ideas for the Dashboard

These ideas focus on leveraging multiple data points (Player Stats, War Logs, Clan Details) and emerging game mechanics (October 2025 update notes) to generate competitive advantage and actionable "Smart Insights".

### 1. Longitudinal War Performance and Consistency Analysis

The current data provides comprehensive war log details, including clan-level statistics like total attacks, stars, destruction percentage, and win/loss/tie outcomes. This trove of historical data (up to 100+ wars documented) allows for deep historical reporting.

| Reporting Idea | Metrics/Data Utilized | Insight Gained |
| :--- | :--- | :--- |
| **War Attendance/Participation Rate** | Compare total members in the clan (`clan_full_details.members`) against the count of players listed in the CWL group (`cwl_group.members`) and participants in historical wars (`war_log.items` details). | Identifies players (by tag/name) who opt out of or miss mandatory war/CWL cycles. Crucial for managing the roster health and addressing low **Participation (PAR) component of ACE Score**. |
| **"Win Quality" Metric (WQM)** | Calculate the ratio of `stars` / (`teamSize` * 3) AND `destructionPercentage` (from `war_log`). | Moves beyond binary W/L/T results to quantify *how decisively* the clan performs. For instance, a win with 96% destruction might be less dominant than a perfect 100% win. |
| **Opponent Strength Index (OSI)** | Calculate the average Town Hall level of the opponent's war roster members (if available in the war log, like in CWL data) or infer opponent strength from their `clanLevel` and League (`warLeague.name`). | Contextualizes the clan's win/loss history. Winning a high-destruction war against a much higher-level clan (e.g., Clan Level 18 vs. Clan Level 7) is more valuable than winning against a low-level opponent. |

### 2. Player Progression Debt and Efficiency (Rush Analytics)

The application already tracks **Rush Percentage**. Groundbreaking analysis involves weaponizing this calculation with resource statistics.

| Reporting Idea | Metrics/Data Utilized | Insight Gained |
| :--- | :--- | :--- |
| **Progression Velocity (PV)** | Track *change* in `heroes[].level` and `troops[].level` (from detailed player profile) between snapshots. Normalize this change by the perceived `Rush Percentage`. | Identifies "Fast Fixers" (rushed bases actively catching up) versus "Stagnant Rushers." This is the inverse of the Rush% calculated in `calculations.ts`. |
| **Loot Efficiency Ratio** | Cross-reference `Gold Grab`, `Elixir Escapade`, and `Heroic Heist` achievement values (total resources looted) with the player's tenure (`tenure_days`). | Determines how efficiently a player farms resources over their lifetime/tenure. Helps measure if a member is maximizing the **200% attack loot bonuses** promised in the October 2025 update. |

### 3. Smart Insights: Predictive Tournament Readiness (Leveraging October 2025 Update)

The introduction of the **34-tier league system** and **weekly tournaments** presents critical new data points for AI-driven insights.

| Reporting Idea | Metrics/Data Utilized | Insight Gained |
| :--- | :--- | :--- |
| **Weekly Attack Utilization Tracker** | Track member performance against the **league-allowed attack limits** for the weekly tournaments. This requires a new data point derived from the API stream (which updates real-time for war attacks). | Essential for **War Participation (PAR) management**. Identifies members maximizing their attack potential or those wasting attacks/participation slots, linking directly to the strategic need for coordination. |
| **Defensive Snapshots Health Check** | Monitor the effectiveness of a player's base using their `defenseWins`. Use this in conjunction with new metrics like **Shadow Base Performance** (if exposed via API in a future iteration, currently listed as Advanced Analytic needed). | Provides actionable intelligence for improving defense, which is critical due to the new layout optimization requirements tied to tournament snapshots. |
| **Tiered League Health Check** | Analyze the distribution of clan members across the 34-tier league system (available via `leagueTier` in the real data examples). Use this to predict **promotion/demotion risk** and assess the diversity of Town Halls across the critical league floors. | Allows leaders to strategically manage trophies and protect lower TH members from unfair matches. |

### 4. Roster Quality and Health Analytics

Focus on identifying high-value and high-risk members based on derived metrics.

| Reporting Idea | Metrics/Data Utilized | Insight Gained |
| :--- | :--- | :--- |
| **Donation/Demand Ratio (DDR)** | Calculate a ratio of **donations given** / (donations received + `clanCapitalContributions`). | Measures the member's generosity relative to their *total clan resource usage*. A high ratio indicates a net positive contributor (e.g., potential "Active Donator" label translation). Conversely, a massive imbalance (like Zouboul receiving 104 donations and giving 0) flags low support activity. |
| **Tenure Decay Warning** | Correlate long `tenure_days` with a low rolling **Weighted Activity Score (WAS)** (Proxy 1-4). | Automatically flags "ghost members"—those who have been loyal for a long time but have recently dropped activity dramatically, aiding roster management. |
| **Role Effectiveness Score** | Compare the average metrics (Donation Velocity, War Performance) of members with `role: admin` or `coLeader` against the general membership. | Ensures leadership roles are actively contributing beyond basic member requirements, linking roles directly to accountability and performance metrics defined in the system's purpose. |

---

## III. Implementation Considerations

### Data Requirements

1. **Snapshot Frequency**: To accurately track deltas (ΔDonations, ΔTrophies, etc.), snapshots should be taken at least daily, ideally multiple times per day during active periods (e.g., Clan Games, Capital Raids).

2. **Historical Data Storage**: The `member_snapshot_stats` table should retain sufficient history (minimum 30 days, ideally 90 days) to calculate rolling averages and detect trends.

3. **New Derived Tables**: Consider creating:
   - `activity_scores` - Pre-calculated WAS for each member
   - `war_performance_history` - Aggregated war metrics per member
   - `progression_tracking` - Hero/troop level changes over time

### Technical Architecture

1. **Calculation Pipeline**: 
   - Run activity calculations as part of the post-processing step in `run-staged-ingestion.ts`
   - Store results in dedicated tables for fast dashboard queries
   - Use materialized views for complex aggregations

2. **Real-Time Updates**:
   - Current daily cron at 3 AM UTC provides baseline
   - Consider adding hourly snapshots during event windows (Friday-Monday for Capital Raids)
   - Implement webhook listeners for war events if API supports

3. **Performance Optimization**:
   - Index all player tags and snapshot dates
   - Pre-calculate expensive metrics during ingestion
   - Cache frequently accessed aggregations

### UI/UX Considerations

1. **Dashboard Widgets**:
   - Activity heatmap showing member engagement over time
   - War performance trends with opponent strength context
   - Roster health score with actionable recommendations
   - "At Risk" member alerts based on Tenure Decay Warning

2. **Filtering and Sorting**:
   - Add WAS as a sortable column in roster table
   - Filter by activity level (Active/Moderate/Inactive)
   - Highlight members with declining trends

3. **Smart Insights Integration**:
   - Auto-generate weekly reports for clan leaders
   - Flag anomalies (sudden activity drops, unusual donation patterns)
   - Suggest roster actions (promote active members, check in with inactive ones)

---

## IV. Priority Roadmap

### Phase 1: Foundation (Immediate)
- ✅ Fix cron job (COMPLETED)
- ✅ Establish daily snapshot pipeline (COMPLETED)
- ⏳ Implement basic delta tracking (donations, trophies)
- ⏳ Create `activity_scores` table

### Phase 2: Core Metrics (Next Sprint)
- Calculate Weighted Activity Score (WAS)
- Implement Donation/Demand Ratio (DDR)
- Add War Attendance tracking
- Create basic activity dashboard widget

### Phase 3: Advanced Analytics (Future)
- Progression Velocity tracking
- Win Quality Metric (WQM)
- Opponent Strength Index (OSI)
- Predictive tournament readiness

### Phase 4: AI-Powered Insights (Long-term)
- Automated roster health reports
- Predictive member churn analysis
- Personalized improvement recommendations
- Strategic war matchup optimization

---

## V. Success Metrics

Track the effectiveness of these new features by measuring:

1. **User Engagement**: Time spent on activity analytics pages
2. **Actionability**: Number of roster decisions made based on insights
3. **Retention**: Clan member retention rates before/after implementation
4. **Performance**: Clan war win rate improvements
5. **Satisfaction**: Leader feedback on utility of new metrics

---

## VI. ACE Score Evolution: From Season-Long to Weekly Competitive Index (WCI)

### Current ACE Score Limitations

The existing ACE Score (All-Mode Clan Excellence), as defined in the application specification, serves as a comprehensive player metric composed of weighted components: Offense vs Expectation (OVA), Defense (DVA), Participation (PAR), Capital Raids (CAP), and Donations/Balance (DON). This score undergoes robust standardization, shrinkage by sample size, weighted summation, logistic squash, and an availability multiplier.

Given the revolutionary changes introduced by the October 2025 update—specifically the splitting of multiplayer into Ranked Mode (Competitive) and Battle Mode (Farming), along with the creation of the 34-tier League System—the current ACE Score is likely insufficient to definitively determine the "top player in the clan" for a given week.

**Critical Shortcomings:**

1. **War Skew**: The current components heavily weigh traditional Clan Wars (OVA, DVA, PAR) and Clan Capital (CAP). While important, these are now overshadowed by the weekly Ranked Tournament Cycle, which dictates a player's current standing within the new 34-tier competitive structure.

2. **Obsolete Trophy Relevance**: Since trophies are now only earned/lost in Ranked Battles and reset after each weekly League Tournament, the old measurement of a player's trophies (which updates in real-time) is no longer a proxy for competitive skill but rather a snapshot of recent Ranked performance.

3. **Lack of Progression Context**: While the dashboard tracks Rush Percentage, the ACE Score fails to fully integrate the cost/time efficiency gains (Progression Velocity) with competitive performance, meaning a highly rushed player who is performing exceptionally well in their mandated League Floor might be scored too low simply due to their Rush% metric.

### Proposed: Weekly Competitive Index (WCI)

To accurately identify the "top player in the clan for a given week," the ACE Score should be restructured into a **Weekly Competitive Index (WCI)** that prioritizes time-gated, skill-based activities tied to the tournament cycle.

The WCI focuses on **Competitive Performance (Ranked)** and **Account Progression/Support (Farming/Clan)**.

#### I. Competitive Performance (CP) Score (60% Weight)

This component measures objective skill execution in the weekly Ranked Tournament (Tuesday 5 AM – Monday 5 AM UTC).

| Proposed Metric | Data Source & Calculation | Competitive Insight |
| :--- | :--- | :--- |
| **1. Tournament Utilization Rate (TUR)** | Attacks Used / League-Allowed Attacks per Week. A player must maximize their 6-30 limited attacks based on their league tier. | Measures Weekly Dedication/Participation in the core competitive event, directly addressing the penalty for not attacking. |
| **2. Tournament Trophy Efficiency (TTE)** | (Trophies Earned Offense + Trophies Earned Defense) / Max Potential Trophies (40 trophies/attack). | Measures Offensive and Defensive Mastery. Tripling is critical (40 trophies), whereas a 99% two-star yields only 16-32 trophies, making 3-star efficiency paramount. |
| **3. League Advancement Index (LAI)** | Score for achieving Promotion Zone (or avoiding Demotion) within the 100-player weekly tournament group. | Measures Climbing Success and prestige. This is the central goal of the new Ranked Mode. |
| **4. Defense Resilience Score (DRS)** | Total Trophies Gained on Defense / Total Trophies Potential Lost (40 x Defenses Taken). | Quantifies the success of the member's weekly defensive snapshot, especially critical since successful defense earns trophies. |

#### II. Progression & Support (PS) Score (40% Weight)

This component addresses long-term account health and the traditional clan support roles.

| Proposed Metric | Data Source & Calculation | Supporting Insight |
| :--- | :--- | :--- |
| **1. Progression Debt Reduction (PDR)** | Inverse calculation of Rush Percentage vs. expected progression velocity derived from the massive permanent hero time/cost reductions. | Rewards players who actively utilize the accelerated upgrade path (now that heroes are crucial for Ranked success) to fix their bases quickly. |
| **2. Donation & Resource Support (DRS)** | Donations Given / (Donations Received + Clan Capital Contributions). | Maintains the existing "Donation Balance" calculation but adds the Capital Contribution (a critical weekly resource funnel). Ensures the "top player" is not purely a solo competitor but a core clan asset. |
| **3. Star Bonus Completion (SBC)** | Frequency/consistency of completing the Star Bonus which contributes resources and Starry Ore (beginning at Archer League, League 8) and can be completed in both Battle and Ranked modes. | Measures Consistent Daily Engagement beyond just the mandatory Ranked attacks. |

### Implementation Strategy

**Data Capture Requirements:**
- Track Ranked Mode trophy changes (currently available via `leagueTier` in player data)
- Monitor weekly tournament cycles (Tuesday 5 AM – Monday 5 AM UTC)
- Calculate attack utilization against league-specific limits (6-30 attacks/week)
- Track defensive snapshot performance separately from offense

**Calculation Pipeline:**
1. Run WCI calculations weekly on Monday after tournament reset
2. Store historical WCI scores for trend analysis
3. Maintain separate tables for CP and PS components
4. Generate weekly leaderboard for clan members

**UI/UX Enhancements:**
- Weekly "Top Competitor" badge based on highest WCI
- Trend graphs showing WCI over multiple weeks
- Breakdowns showing CP vs PS contributions
- Tournament utilization tracker (attacks used vs available)

### Conclusion on ACE Score Evolution

The original ACE Score needs to evolve from merely aggregating five metrics to weighting performance based on the game's new focal point: **Weekly Competitive Tournaments**.

By pivoting to the Weekly Competitive Index (WCI), the dashboard can immediately provide clan leaders with a highly relevant score demonstrating who is:
- Maximizing their skill potential in Ranked Mode
- Coordinating their limited attacks effectively
- Optimizing their base defenses for the snapshot system
- Making rapid progression on their heroes
- Contributing to clan support activities

This new WCI directly utilizes the complex mechanics introduced in the October 2025 overhaul to accurately reflect the true "top player" status in the contemporary version of Clash of Clans.

---

## VII. Related Documentation

- `COC_API_MASTER_INDEX.md` - Complete API reference
- `COC_API_REAL_DATA_EXAMPLES.json` - Real data samples
- `docs/architecture/data-spine.md` - Current data architecture
- `web-next/src/lib/calculations.ts` - Existing metric calculations (includes current ACE Score implementation)
- `AUTOMATED_CRON_FOREVER.md` - Ingestion pipeline documentation

---

## VIII. Next Steps

1. **Immediate**: Review this document with stakeholders and prioritize Phase 1 implementation items
2. **Short-term**: Begin WCI prototype development alongside existing ACE Score
3. **Medium-term**: A/B test WCI vs ACE Score with clan leaders for effectiveness
4. **Long-term**: Fully transition to WCI as primary competitive metric once validated

