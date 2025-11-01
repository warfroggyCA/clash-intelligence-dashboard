# VIP Score Specification
**VIP = Very Important Player**

A comprehensive metric measuring dedication (effort) and success (skill/outcome) across all game modes.

---

## Core Formula

```
VIP = (0.50 × Competitive) + (0.30 × Support) + (0.20 × Development)
```

Where:
- **Competitive** = Ranked Performance + War Performance (50% weight)
- **Support** = Donations + Capital Contributions (30% weight)
- **Development** = Base Quality + Activity (20% weight)

---

## Component Breakdown

### Competitive Performance (50% weight)

#### CP = (0.60 × Ranked) + (0.40 × War)

**Ranked Performance (60% of Competitive):**
- **LAI** (70%): League Advancement Index - Promotion/Retention/Demotion
- **TPG** (30%): Trophy Progression Gain - Weekly trophy delta

**War Performance (40% of Competitive):**
- Uses existing ACE Score war components (OVA, DVA)
- Simplified to: `War Score = (0.60 × OVA) + (0.40 × DVA)`
- Defaults to 50 if no war data

---

### Support Performance (30% weight)

#### SP = (0.60 × Donations) + (0.40 × Capital)

**Donation Support (60% of Support):**
- Uses existing WCI donation calculation
- Ratio: `donationsGiven / max(1, donationsReceived + capitalContributions)`
- Bonus for high absolute donations (500+, 200+, 100+)

**Capital Support (40% of Support):**
- Week-over-week capital contributions delta
- Scoring: +1000 = 100, +500 = 75, +100 = 50, >0 = 25

---

### Development Performance (20% weight)

#### DP = (0.50 × Base Quality) + (0.50 × Activity)

**Base Quality (50% of Development):**
- **PDR**: Progression Debt Reduction (100 - rushPercent)
- Lower rush% = higher score

**Activity (50% of Development):**
- **Capital Delta** (40%): Week-over-week capital contributions change
- **Achievement Delta** (30%): Week-over-week achievement score change
- **War Participation** (30%): Flag if war_stars increased during week

---

## Scoring Range

- **0-100** scale
- **80-100:** Exceptional VIP contributor
- **60-79:** Strong contributor
- **40-59:** Average contributor
- **20-39:** Below average
- **0-19:** Minimal contribution

---

## Data Requirements

**All from existing API/data spine:**
- Ranked: `ranked_trophies`, `ranked_league_id`, `ranked_league_name`
- War: `war_stars`, `attack_wins`, `defense_wins` (from ACE calculation)
- Support: `donations`, `donations_received`, `capital_contributions`
- Development: `rush_percent`, `achievement_score`, `war_stars` (for participation)

---

## Calculation Frequency

- **Weekly**: Calculated on Monday snapshots (same as WCI)
- **Historical**: Store weekly VIP scores for trend analysis

---

## Key Differences from WCI

1. **Adds War Performance** - Incorporates ACE war components
2. **Expands Support** - Capital delta tracking
3. **Improves Activity** - Removes duplication, adds capital/achievement/war metrics
4. **Broader Scope** - Measures all-mode contribution, not just ranked

---

## Migration from WCI

- Existing WCI data can be converted:
  - LAI → Competitive (Ranked)
  - TPG → Competitive (Ranked)
  - Donation Support → Support (Donations)
  - PDR → Development (Base Quality)
  - Activity → Development (Activity) - but redesigned

