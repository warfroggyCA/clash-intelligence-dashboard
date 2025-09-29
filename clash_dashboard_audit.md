# Clash Intelligence Dashboard – Product Audit & Roadmap (Players & Leaders)

**Goal:** Make the dashboard an *indispensable* daily tool for players and leaders by emphasizing **clarity, fairness, actionability, and reliability**.  
**Inputs reviewed:** Your current tracking, planned enhancements, and open considerations.

---

## TL;DR — What to Keep, Consolidate, Add, and Improve

### Keep (foundational & valuable)
- **ACE Leader tile + Modal**: Keep as the flagship *contribution* metric with transparent component breakdowns.
- **Roster Snapshot essentials**: Members, War Win Rate (with sample size), Ace leader highlight, Last Updated.
- **FAQ (live, explorable)**: Keep the in-product “explain my score” experience with interactive scenarios.
- **AceScoreLibrary + JestAceTests**: Keep and extend to new metrics (HM/EI).

### Consolidate (reduce surface area & duplication)
- **Home = Snapshot + Insights** → One “What changed since last visit” feed (delta-based) instead of separate Snapshot + TodayHeadlines + RosterHighlights.
- **ACE Help** → Merge ACE section of FAQ + ACE Modal *Info popovers* into a single “Learn ACE” drawer shared across views.
- **Assets/Utilities docs** → Move spec, assets, helpers into a unified **Developer Docs** page (link from footer).

### Missing (to be truly indispensable)
1. **Hero Momentum & Engagement Index (EI)**: Weekly HM + 4‑week EMA, idle streaks, EI 0–100 (already planned).  
2. **War Readiness** *(per player & per war)*: Hero availability countdown, upgrade-in-progress flags, and **War Attendance Reliability (WAR)**.  
3. **Attack Quality & Consistency**: Rolling **War Attack Quality (WAQ)** score from last N wars (recency‑weighted stars).  
4. **CWL Squad Builder**: Auto-suggest ideal 15/30 based on ACE, WAQ, EI, TH distribution and hero availability.  
5. **Clan Capital Engagement**: Raid Weekend participation rate, capital gold donated/earned, avg districts cleared.  
6. **Churn Risk & Recovery**: Early alert using EI trend + donation dip + missed wars; “Recovery” recognition tile.  
7. **Goal Tracking**: Player-set upgrade goals with ETA check; nudge if off‑pace.  
8. **Privacy/Sharing Modes**: Role‑based redaction (Leader vs Member vs Public link) rather than simple blur.  
9. **Audit & Change Log**: “Since last visit” diff: new joins/leaves, promotions, streak breaks, EI drops, war outcomes.

### Improve (what’s there today)
- **Averages → Distributions**: Replace AverageTownHall/AverageTrophies with **TH distribution**, **league mix**, and **percentiles** (P50/P80).  
- **BuilderBaseAverage** → **Clan Capital block** (raid participation & medals); Builder Base can move to player card details.  
- **War Win Rate** → Add **sample size** and **expected value** (Elo‑like opponent strength proxy or rolling baseline).  
- **ACE Explainability** → “Why did ACE change?” diff line items per component since last snapshot.  
- **Snapshot freshness** → Prominent data staleness banner + auto SWR refresh + last successful ingestion timestamp.  
- **Public safety** → Replace blur with field‑level redaction & opt‑in public toggles (hide tags, EI, donations by default).  
- **Perf stability** → Fix render loop (see Engineering Notes).  
- **Testing** → Extend Jest to HM/EI, add property‑based tests for monotonicity and invariants.  

---

## Proposed Information Architecture (Player-first & Leader-first)

**Top Nav:** Home · Compete · Plan · Coach · Ops · FAQ

- **Home (Delta Feed)**: “What changed since last visit” + quick actions (ping, congratulate, bench/unbench).
- **Compete (Leaderboards)**: ACE, EI, CCS (combined), Streaks, WAQ, Generosity (donations). Filters by TH, tenure, role.
- **Plan (War/CWL)**: War Readiness board, CWL Squad Builder, Availability matrix, upgrade conflicts, hero countdowns.
- **Coach (Player Cards)**: Per‑player profile → ACE/EI trends, WAQ, donation ratio, goals & streaks, churn risk, notes.
- **Ops (Clan Capital & Admin)**: Raid Weekend stats, join/leave log, privacy roles, ingestion status, test suite status.
- **FAQ/Docs**: ACE spec, HM/EI math, examples, data sources & runbook, glossary.

---

## Metric Additions & Definitions

### 1) Hero Momentum & Engagement Index (EI)
- **HM (weekly):** `ΔBK + ΔAQ + ΔGW + ΔRC`  
- **HMT (trend):** `EMA(HM, span=4)`  
- **Idle Weeks (IW):** consecutive weeks HM=0  
- **Upgrade Streak (US):** consecutive weeks HM≥1  
- **EI (0–100):** `EI = 100 - (IW*12) + (US*4) + (HMT*6)`  
- **Watchlist thresholds:** EI<60 soft; EI<45 hard; EI drop ≥10 in 3 weeks.

### 2) War Readiness & Reliability
- **Hero Availability Index (HAI):** 0–100 based on #heroes ready vs total; −penalty for active upgrades overlapping war window.  
- **War Attendance Reliability (WAR):** `participated / eligible` across last K wars (recency‑weighted).  
- **Conflict Detector:** Raises flag if scheduled hero upgrade overlaps declared war or CWL days.

### 3) War Attack Quality (WAQ)
- **Definition:** Recency‑weighted average stars from last N war attacks. Penalize missed/zero attacks. Scale 0–100.  
- **Usage:** Input for CWL Squad Builder; coaching focus list (low WAQ, high EI = coachable).

### 4) Clan Capital Engagement
- **Participation:** % members who attacked last Raid Weekend.  
- **Contribution:** Capital gold donated/earned per player (normalized per TH if needed).  
- **Effectiveness:** Avg districts cleared per participant; defense hold rate (if available).

### 5) Combined Clan Score (CCS)
- **Formula:** `CCS = (0.65 * normalized ACE) + (0.35 * normalized EI)`  
- **Purpose:** All‑rounder leaderboard; recruitment signal.

---

## UI / Visualization Changes

- **Delta Feed Cards** (Home): “Player X +2 HM”, “EI −12 (watchlist)”, “New joiner: TH13”, “War win vs [Clan] 27–24”.
- **Leaderboards**: Add tabs (ACE · EI · CCS · WAQ · Streaks). Sticky filters: TH tier, tenure, role, war eligibility.
- **Player Cards**: Sparkline trends (ACE/EI/WAQ), readiness dial, donation ratio, goals, notes, last contact/DM button.
- **War Board**: Grid of war roster with HAI, WAQ, EI, hero ready timers; bench suggestions w/ explanations.
- **Clan Capital Panel**: Raid Weekend tiles, participation %, top contributors, recovery highlights.
- **Privacy Controls**: Per‑field toggles in share modal (e.g., hide player tags, donations, EI by default).

---

## Consolidation Map (Old → New)

- **Roster Snapshot + TodayHeadlines + RosterHighlights** → **Home (Delta Feed + Snapshot strip)**  
- **ACE Leaderboard Modal + FAQ ACE Section** → **Compete (ACE tab) + “Learn ACE” drawer**  
- **BuilderBaseAverage** → **Clan Capital panel** (Ops)  
- **InformationalFactorsList (ACE)** → **One canonical “Learn ACE” drawer**  
- **Assets & Utilities docs** → **FAQ/Docs: Developer section**

---

## Data Model Additions (Supabase)

### `hero_progress_snapshots`
```
player_tag TEXT, week_start DATE, th INT,
bk_lvl INT, aq_lvl INT, gw_lvl INT, rc_lvl INT,
bk_delta INT, aq_delta INT, gw_delta INT, rc_delta INT,
hm INT, hmt NUMERIC, idle_weeks INT, upgrade_streak INT,
ei NUMERIC, notes JSONB, PRIMARY KEY(player_tag, week_start)
```

### `war_participation`
```
clan_tag TEXT, war_id TEXT, start_time TIMESTAMP, war_type TEXT, size INT,
player_tag TEXT, participated BOOL, attacks_used INT, stars INT, destruction NUMERIC,
bench_reason TEXT, PRIMARY KEY(war_id, player_tag)
```

### `war_readiness`
```
war_id TEXT, player_tag TEXT,
heroes_ready INT, heroes_total INT, availability_score NUMERIC,  -- HAI
upgrade_conflict BOOL, conflict_detail TEXT, updated_at TIMESTAMP,
PRIMARY KEY(war_id, player_tag)
```

### `capital_weekend`
```
clan_tag TEXT, weekend_start DATE,
player_tag TEXT, participated BOOL, districts_cleared INT,
capital_gold_earned INT, capital_gold_donated INT,
PRIMARY KEY(clan_tag, weekend_start, player_tag)
```

### `player_goals`
```
player_tag TEXT, goal_type TEXT, target_lvl INT, by_date DATE,
status TEXT, created_at TIMESTAMP, PRIMARY KEY(player_tag, goal_type, created_at)
```

---

## Automation & Alerts (Discord)

- **Mondays 09:00:** “Top 5 Momentum” + “Needs a Nudge” (EI < 60).  
- **War spin T‑24h:** List upgrades finishing before war; flag conflicts.  
- **CWL Day 1:** Auto-pick proposal for squad based on HAI + WAQ + ACE + EI.  
- **Raid Weekend end T‑2h:** Participation reminder; tag non‑participants with opt‑in role.  
- **Recovery Kudos:** When EI rebounds +8 in 2 weeks → shoutout.

---

## Engineering Notes

### Render Loop / State Stability (Zustand + React)
- **Root cause classes**: derived selectors causing feedback sets; effects writing to store on every render; unstable dependencies.  
- **Mitigations:**
  - Use **subscribeWithSelector** and select minimal slices; guard with shallow compare.  
  - Move expensive or derived calculations into **useMemo** or precompute server-side.  
  - Avoid `setState` inside render/derived selectors; do it in controlled effects with **strict dependency arrays**.  
  - Debounce/throttle snapshot updates; single **initStore()** path on mount; never in multiple components.  
  - Add a **state transition test** that mounts key containers and asserts a bounded render count.  

### Snapshot Currency
- **SWR** strategy with `stale-while-refresh` banner + absolute timestamp (UTC).  
- **“Last Ingestion”** health tile in Ops; show error states and fallbacks (previous snapshot + diff disabled).

### Testing
- Extend **Jest** to HM/EI with property tests:
  - EI must **not** increase when IW increases (holding others constant).  
  - EI must **increase** with higher HMT (holding others constant).  
  - Streak break should drop EI by ≥ fixed delta.  
- **Golden tests** for ACE + EI on fixed synthetic rosters; snapshot the leaderboard ordering.

---

## Privacy & Sharing

- **Role-based visibility**: Leader can see full donations/EI; Member sees limited own details; Public link hides personal fields.  
- **Field-level redaction** over blur: remove sensitive numbers from payload for public mode.  
- **Audit**: Log when a public link is created and which fields are exposed.

---

## Success Metrics (KPIs)

- **Adoption**: DAU/WAU, avg session duration, % of members who view weekly.  
- **Actionability**: # of alerts acted on (nudges sent, benches, squad changes).  
- **Outcomes**: War win rate vs prior 30 days; participation rate; EI median trend; capital participation rate.  
- **Quality**: Data freshness SLA (e.g., 95% of pages show snapshot < 24h old).

---

## Prioritized Roadmap

### Now (0–2 weeks)
1. **Hero Momentum/EI v1** (backend + tiles + watchlist).  
2. **Home Delta Feed** (unify Snapshot + Highlights).  
3. **Privacy roles** (Leader/Member/Public gating for key fields).  

### Next (2–6 weeks)
4. **War Readiness & WAR** (availability timers + attendance reliability).  
5. **WAQ** (recency‑weighted stars; coaching list).  
6. **Clan Capital panel** (participation + contributions).  
7. **ACE “Why it changed” diffs** and EI recovery highlights.

### Later (6–12 weeks)
8. **CWL Squad Builder** (explainable picks + overrides).  
9. **Goal tracking + nudges** (upgrade ETAs).  
10. **Public share presets** and detailed audit logs.  

---

## One-liners you can reuse in UI copy

- “**EI** tells us if you’re still pushing your account forward; **ACE** tells us how much you’re lifting the clan.”  
- “Weekly for competition, rolling for fairness.”  
- “We track **what changed**, not just what is.”

