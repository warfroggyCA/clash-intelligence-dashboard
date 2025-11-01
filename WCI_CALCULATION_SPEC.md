# Weekly Competitive Index (WCI) - Calculation Specification

## Overview

**WCI** is a 0-100 composite metric measuring weekly player performance in Clash of Clans (October 2025+ ranked mode mechanics). It balances competitive ranked performance (60%) with clan support and base development (40%).

**Core Formula:**
```
WCI = (0.60 × CP) + (0.40 × PS)
```

Where:
- **CP** = Competitive Performance (Ranked Mode) - 60% weight
- **PS** = Progression & Support (Farming/Clan activities) - 40% weight

**Critical Constraint:** All calculations use ONLY data available from the official Clash of Clans API. No estimates, assumptions, or derived metrics.

---

## Competitive Performance (CP) - 60% Weight

CP measures ranked mode performance through two components:

### CP = (0.40 × TPG) + (0.60 × LAI)

### 1. Trophy Progression Gain (TPG) - 40% of CP

**Purpose:** Measures weekly trophy gain/loss in ranked mode.

**Formula:**
```
TPG = clamp(50 + (delta / 8), 0, 100)
```

Where:
- `delta = rankedTrophiesEnd - rankedTrophiesStart`
- `clamp(value, min, max)` ensures result stays within 0-100

**Scoring Logic:**
- **+800 trophies** = 100 (exceptional performance)
- **0 trophies** = 50 (neutral)
- **-400 trophies** = 0 (severe loss)
- **Missing data** = 50 (neutral fallback)

**Linear Scale:** Each 8 trophy delta = 1 point on 0-100 scale, centered at 50.

**Example:**
- Start: 500 trophies, End: 700 trophies → delta = +200 → TPG = 75.0
- Start: 300 trophies, End: 100 trophies → delta = -200 → TPG = 25.0

---

### 2. League Advancement Index (LAI) - 60% of CP

**Purpose:** Measures league tier progression (promotion/retention/demotion).

**Tier Extraction:**
- League IDs format: `105000001` to `105000034` (tiers 1-34)
- Extract tier: `tierNumber = leagueTierId % 1000000`
- Example: `105000013` → tier `13`

**Scoring Logic:**
- **Promotion** (tierEnd > tierStart): **100** points
- **Same tier + active** (tierEnd == tierStart AND rankedTrophiesEnd > 0): **70** points
- **Same tier + inactive** (tierEnd == tierStart AND rankedTrophiesEnd == 0/null): **40** points
- **Demotion** (tierEnd < tierStart): **20** points
- **Missing tier data + has trophies**: **60** points
- **Missing tier data + no trophies**: **30** points

**Rationale:** Promotion is the ultimate competitive achievement, hence 60% weight in CP.

**Example:**
- Tier 13 → Tier 14: LAI = 100
- Tier 14 → Tier 14 (active): LAI = 70
- Tier 14 → Tier 13: LAI = 20

---

## Progression & Support (PS) - 40% Weight

PS measures clan contribution and base development through three components:

### PS = (0.35 × PDR) + (0.40 × Donation Support) + (0.25 × Activity)

### 1. Progression Debt Reduction (PDR) - 35% of PS

**Purpose:** Measures base development quality (anti-rush metric).

**Formula:**
```
PDR = 100 - rushPercent
```

Where:
- `rushPercent` = percentage of base that is rushed (0-100)
- Lower rush% = higher PDR score

**Scoring Logic:**
- **0% rushed** = 100 points (perfectly developed)
- **50% rushed** = 50 points (neutral)
- **100% rushed** = 0 points (severely rushed)
- **Missing data** = 50 points (neutral fallback)

**Clamping:** Result clamped to 0-100 range.

---

### 2. Donation & Resource Support - 40% of PS

**Purpose:** Measures clan contribution via donations and capital contributions.

**Formula:**
```
ratio = donationsGiven / max(1, donationsReceived + capitalContributions)
baseScore = min(100, ratio × 50)
```

**Bonus System:**
- `donationsGiven >= 500`: +20 points (capped at 100)
- `donationsGiven >= 200`: +10 points (capped at 100)
- `donationsGiven >= 100`: +5 points (capped at 100)

**Final Score:** `min(100, baseScore + bonus)`

**Rationale:** High absolute donation counts get bonus recognition, even if ratio is modest.

**Example:**
- Given: 500, Received: 200, Capital: 100 → ratio = 1.67 → baseScore = 83.5 → +20 bonus → **100**
- Given: 50, Received: 100, Capital: 0 → ratio = 0.5 → baseScore = 25 → **25**

---

### 3. Weekly Activity Score - 25% of PS

**Purpose:** Measures overall weekly engagement (proxy metric).

**Components:**

**A. Donation Activity (0-50 points):**
- `donationsGiven >= 500`: +50
- `donationsGiven >= 200`: +40
- `donationsGiven >= 100`: +30
- `donationsGiven >= 50`: +20
- `donationsGiven >= 10`: +10
- `donationsGiven > 0`: +5
- `donationsGiven == 0`: +0

**B. Trophy Activity (0-50 points):**
- `trophyDelta >= 200`: +50
- `trophyDelta >= 100`: +40
- `trophyDelta >= 50`: +30
- `trophyDelta >= 0`: +20
- `trophyDelta >= -50`: +10
- `trophyDelta < -50`: +0
- Missing start data but `rankedTrophiesEnd > 0`: +20

**Final Score:** `min(100, donationActivity + trophyActivity)`

**Maximum:** 100 points (50 + 50)

---

## Final WCI Calculation

```
WCI = (0.60 × CP) + (0.40 × PS)
```

**Scoring Range:** 0-100
- **80-100:** Exceptional performance
- **60-79:** Strong performance
- **40-59:** Average performance
- **20-39:** Below average
- **0-19:** Poor performance

---

## Data Requirements

**All inputs must come from Clash of Clans API:**

### Snapshot Data (Week Start/End):
- `rankedTrophiesStart` / `rankedTrophiesEnd` (number | null)
- `leagueTierStart` / `leagueTierEnd` (number | null) - League ID (e.g., 105000013)
- `leagueNameStart` / `leagueNameEnd` (string | null)

### Support Metrics:
- `rushPercent` (number | null) - Base rush percentage
- `donationsGiven` (number) - Weekly donations given
- `donationsReceived` (number) - Weekly donations received
- `capitalContributions` (number) - Clan capital contributions

### Week Period:
- `weekStart` (Date) - Tournament week start (Tuesday 5 AM UTC)
- `weekEnd` (Date) - Tournament week end (Monday 5 AM UTC)

---

## Calculation Flow

1. **Calculate CP Components:**
   - TPG = `calculateTPG(rankedTrophiesStart, rankedTrophiesEnd)`
   - LAI = `calculateLAI(leagueTierStart, leagueTierEnd, rankedTrophiesEnd)`
   - CP = `(TPG × 0.40) + (LAI × 0.60)`

2. **Calculate PS Components:**
   - PDR = `calculatePDR(rushPercent)`
   - Donation Support = `calculateDonationSupport(donationsGiven, donationsReceived, capitalContributions)`
   - Activity = `calculateWeeklyActivity(donationsGiven, rankedTrophiesStart, rankedTrophiesEnd)`
   - PS = `(PDR × 0.35) + (Donation Support × 0.40) + (Activity × 0.25)`

3. **Calculate Final WCI:**
   - WCI = `(CP × 0.60) + (PS × 0.40)`
   - Round to 2 decimal places

---

## Example Calculation

**Player: warfroggy**
- **Trophies:** Start: null, End: 0 (data quality issue)
- **League:** Tier 13 → Tier 14 (promoted!)
- **Rush:** 2% (very well developed)
- **Donations:** Given: 50, Received: 500, Capital: 0
- **Activity:** 50 donations, 0 trophy delta

**CP Calculation:**
- TPG: 50 (missing data fallback)
- LAI: 100 (promotion)
- CP = (50 × 0.40) + (100 × 0.60) = **80.0**

**PS Calculation:**
- PDR: 98 (100 - 2)
- Donation Support: ratio = 50/500 = 0.1 → baseScore = 5 → **5.0**
- Activity: donations = 20 points, trophies = 0 points → **20**
- PS = (98 × 0.35) + (5 × 0.40) + (20 × 0.25) = **48.3**

**Final WCI:**
- WCI = (80.0 × 0.60) + (48.3 × 0.40) = **67.3**

---

## Design Principles

1. **API-Only Data:** No assumptions, estimates, or derived metrics not available from API
2. **Promotion-Heavy:** League promotion is the ultimate competitive achievement (60% of CP)
3. **Balanced:** 60% competitive, 40% support - rewards both ranked play and clan contribution
4. **Transparent:** All formulas are explicit and verifiable
5. **Robust:** Handles missing data gracefully with neutral fallbacks
6. **Weekly Context:** Captures weekly performance snapshot (Tuesday 5 AM UTC → Monday 5 AM UTC)

---

## Known Limitations

1. **Missing Trophy Data:** Historical snapshots may have null/0 trophy values, causing TPG to default to neutral (50)
2. **Rush Percent:** Requires base analysis; may not be available for all players
3. **Activity Proxy:** Uses donations and trophy changes as proxies; doesn't capture all activity types
4. **No Tournament Stats:** Tournament-specific metrics (attacks used, promotion status) are not available from API

---

## Questions for Review

1. Are the CP/PS weights (60/40) appropriate for measuring overall player contribution?
2. Should promotion (LAI) be weighted even higher than 60% of CP?
3. Is the TPG normalization scale (8 trophies = 1 point) appropriate for typical weekly gains?
4. Does the Donation Support formula properly reward high absolute donations vs. ratio?
5. Should Activity component be expanded or refined?
6. Are the missing-data fallbacks (neutral = 50) appropriate?
7. Should demotion penalty be more severe (currently 20 points)?

