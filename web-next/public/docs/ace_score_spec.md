
# ACE Score — The Single, Unimpeachable “Top Player” Stat
**ACE = All‑Mode Clan Excellence.** One number (0–100) that crowns your best player *to date* and stays fair across Town Halls. Anyone can top it with the right mix of performance, reliability, capital value, and service to clanmates.

---

## What ACE Measures (in plain English)
- **War impact beyond TH** — credit for stars **above expectation** given TH‑difference and base state (opener vs cleanup).  
- **Defense value** — credit for **holds** (not being tripled) relative to what’s expected against you.  
- **Participation** — you showed up: used all attacks in war and Capital. No passengers.  
- **Capital efficiency** — turning weekend attacks into gold and finished districts, not just showing up.  
- **Donation economy** — giving back to the clan (balanced; no abuse of leeching or padding).  
- **Recency & sample size** — recent, repeated proof matters more than one lucky hit.  
- **Integrity** — TH‑neutralization and shrinkage stop stat-padding and cherry-picking.

---

## ACE at a Glance (formula skeleton)
ACE is a **weighted, TH‑neutral, time‑decayed, shrinkage‑aware composite** of five standardized components:

```
ACE_i = 100 * σ( 
    0.40 * OVA*_i  +   # Offensive Value Above Expectation
    0.15 * DVA*_i  +   # Defensive Value Above Expectation
    0.20 * PAR*_i  +   # Participation & Reliability
    0.15 * CAP*_i  +   # Capital Value & Role
    0.10 * DON*_i      # Donation Balance & Culture
)  ×  AVAIL_i
```

Where:
- `σ(x)` is a squashed scaling to keep ACE on a stable 0–100 scale (logistic or min–max across clan).  
- `*_i` denotes **standardized** (robust z-score or percentile) with **TH‑neutralization** and **shrinkage** applied.  
- `AVAIL_i` is a small availability multiplier (0.85–1.00) that rewards month‑long reliability and prevents “two great wars then vanish” gaming.

> Default weights work well; you can recalibrate from history (see “Calibration”).

---

## Components in Detail (implementable today)

### 1) OVA* — Offensive Value Above Expectation (40%)
**Idea:** Reward **new stars above expectation** given *(attacker TH – defender TH)* and base state (fresh vs 1⭐/2⭐).

For each attack `a` by player `i`:
- `prev = stars_on_base_before_attack_a` (0,1,2)
- `new = max(0, stars_after_attack_a - prev)`  (range 0–3, but typically 0–2 unless first hit)
- `ΔTH = attackerTH - defenderTH`
- **Expectation:** `E[new | ΔTH, prev]` built from your last N wars (or league-wide priors if N small)
- **Value:** `v_a = (new - E[new | ΔTH, prev]) / SD[new | ΔTH, prev]`  (standardized residual)
- **Cleanup booster:** multiply `v_a` by `w_cleanup = 1.10` when `prev > 0` (turning partials into wins)
- **Clutch micro‑weight (optional):** `w_time ∈ [0.95, 1.05]` based on attack order and war margin

Then `OVA_i = Σ_a (v_a × w_cleanup × w_time × decay(age_in_wars))`

**TH‑neutralization:** baked into the expectation by conditioning on `ΔTH`.  
**Shrinkage:** `OVA*_i = z_robust( OVA_i )` then **shrink to mean** with factor `k = 6 attacks`:

```
OVA*_i_shrunk = ( n / (n + k) ) * OVA*_i
```

---

### 2) DVA* — Defensive Value Above Expectation (15%)
For each **defense** against player `i`’s base:
- `s = max_stars_conceded_to_base_in_war` (0–3)
- `E[s | enemyTH - defenderTH]` from history
- `d = (E[s] - s) / SD[s]`  (positive when you held better than expected)
- Sum with decay over recent wars.

**Notes:** Counts *holds* (not tripled) heavily; fair because expectation adjusts for attacker TH. Apply the same `k=4 defenses` shrinkage before standardization.

---

### 3) PAR* — Participation & Reliability (20%)
A blend of **did you show up** and **did you finish your homework**:
```
war_use = used_attacks / allowed_attacks           # 0..1
cap_use = used_capital_attacks / allowed_attacks   # 0..1
streak  = weeks_with_full_war_use in last 8 / 8    # 0..1
PAR_raw = 0.55*war_use + 0.30*cap_use + 0.15*streak
```
Standardize to PAR* across clan (robust z). No shrinkage needed (bounded metric).

**Availability multiplier `AVAIL_i` (applied to final ACE):**
```
AVAIL_i = 0.85 + 0.15 * min(1, days_active_last_30 / 26)
```
A reliable month gets you close to 1.0; sporadic players land ~0.90.

---

### 4) CAP* — Capital Value & Role (15%)
Two signals:
- **VPA z‑score:** `VPA = capital_loot / capital_attacks` standardized per district level bucket.
- **Role rates:** `FinisherRate` and `OneHitRate` (both standardized).

Combine:
```
CAP_raw = 0.6*z(VPA) + 0.2*z(FinisherRate) + 0.2*z(OneHitRate)
CAP* = shrink_to_mean( z_robust(CAP_raw), k = 8 capital attacks )
```

---

### 5) DON* — Donation Balance & Culture (10%)
Reward **net giving** without enabling abuse.
```
balance = donations - received
ratio   = donations / max(1, received)
DON_raw = z_robust(balance) + 0.5 * z_robust(ratio_clipped_99p)
DON*    = clamp(DON_raw, -2.5, +2.5)
```
Prevents one whale from dominating purely on donations.

---

## Time Decay (fresh proof matters)
Apply `decay(age)` to OVA and DVA contributions:
```
decay(wars_ago) = 0.75^(wars_ago)      # last 4–6 wars dominate
decay(weeks_ago_capital) = 0.85^(weeks_ago)
```

---

## Calibration (make it predictive, not just pretty)
1) **Per‑war prediction test:** Before each of the last `M` wars, sort players by ACE and compute the share of total stars and cleanups they actually produced. Good ACE shows a monotonic lift.  
2) **Win‑probability lift:** Regress war outcome (win=1) on the **sum of top‑K ACE** going into war vs prior baseline. The coefficient should be positive and significant.  
3) **Holdout validation:** Recompute weights (0.40/0.15/0.20/0.15/0.10) using grid search to maximize AUC for (a) predicting top‑quartile star output and (b) minimizing missed‑attack incidence — on training wars; verify on holdout wars.  
4) **Stability check:** 80% of top‑5 ACE in week T should stay top‑8 in week T+1 unless roster changes.

---

## Guardrails (unimpeachable by design)
- **TH‑neutralization** in OVA/DVA via expectations conditioned on `ΔTH` and base state.  
- **Shrinkage** toward clan mean for small samples to block cherry‑picking.  
- **Recency decay** to curb ancient feats.  
- **Availability multiplier** to stop part‑timers from sniping #1.  
- **Clamping** in donations to avoid padding; same in PAR to avoid zero‑sum penalty.  
- **Transparency:** every ACE comes with a breakdown card (see below).

---

## ACE Breakdown Card (what you show in UI/Discord)
```
ACE 92.4  (Top 1% clan)   |  OVA +1.6σ  •  DVA +0.7σ  •  PAR +0.9σ  •  CAP +0.4σ  •  DON +0.2σ
Recency: strong (last 4 wars)   Availability: 0.98   Sample: 18 attacks, 9 defenses, 26 capital
Highlights: 3× cleanup conversions • 2 punch‑ups (+1 TH) • One‑Hit Rate 33% • Net donor +118
Next step: aim for full capital usage; keep cleanup role.
```
Include 95% CI ribbon if you want (based on shrinkage + sample size).

---

## Inputs You Already Have (API mapping)
- **War attacks & defenses:** `/clans/{tag}/currentwar` during war; `/clans/{tag}/warlog` after.  
- **Capital raids:** `/clans/{tag}/capitalraidseasons` with per‑district attempts and loot.  
- **Roster & donations:** `/clans/{tag}` and `players/{tag}` for roles, TH, donations.  
- **Participation:** attacks used vs allowed (war/capital), war preference flips from `/clans/{tag}` snapshots.

---

## Minimal Implementation Steps
1) **Snapshot & events:** collect attacks/defenses/capital/donations; build expectations `E[new | ΔTH, prev]` and `E[s | ΔTH]` from your own history (fallback to clan‑level priors for the first 3–5 wars).  
2) **Compute components:** OVA, DVA, PAR, CAP, DON with decay and shrinkage.  
3) **Standardize:** robust z‑scores per component; apply weights; squash to 0–100; multiply by availability.  
4) **Render:** leaderboard + breakdown cards; Discord share.  
5) **Validate:** run the calibration tests monthly; keep weights editable.

---

## Defaults (you can change later)
- Weights: `OVA .40, DVA .15, PAR .20, CAP .15, DON .10`.  
- Shrinkage `k`: OVA 6 attacks, DVA 4 defenses, CAP 8 capital attacks.  
- Decay: wars `0.75^(wars_ago)`, capital weekends `0.85^(weeks_ago)`.  
- Availability: `0.85–1.00` linear over “days active in last 30”.  
- Standardization: median/MAD (robust z).

---

## Why anyone can win ACE
- Lower TH can win via **perfect participation**, **elite cleanups**, **high VPA & finishes**, and **net donations**.  
- High TH can’t coast: missing attacks or poor value vs expectation tanks OVA and PAR.  
- The design rewards **team wins**: cleanups, closers, donors, and defenders all count.

---

## Pseudocode (concise)

```python
for player in players:
    OVA = sum_over_attacks( ((new_stars - E_new(ΔTH, prev)) / SD_new(ΔTH, prev))
                            * w_cleanup(prev) * w_time(order, margin)
                            * decay_wars(wars_ago) )
    DVA = sum_over_defenses( ((E_concede(ΔTH) - conceded) / SD_concede(ΔTH))
                             * decay_wars(wars_ago) )
    PAR = 0.55*war_use + 0.30*cap_use + 0.15*streak8
    CAP = 0.6*z(VPA_bucketed) + 0.2*z(FinisherRate) + 0.2*z(OneHitRate)
    DON = z(balance) + 0.5*z(ratio_clipped)

    OVA_star = shrink(zrobust(OVA), k=6, n=attacks_n)
    DVA_star = shrink(zrobust(DVA), k=4, n=defenses_n)
    CAP_star = shrink(zrobust(CAP), k=8, n=cap_attacks_n)
    PAR_star = zrobust(PAR)
    DON_star = clamp(zrobust(DON), -2.5, 2.5)

    core = 0.40*OVA_star + 0.15*DVA_star + 0.20*PAR_star + 0.15*CAP_star + 0.10*DON_star
    ACE   = 100 * squash(core) * availability(days_active_last_30)
```

---

## FAQ
- **Does it double‑count?** No. Offense counts **new stars above expectation**; cleanup is a multiplier, not extra stars. Defense is separate. Capital is weekend‑only. Donations/social are capped.  
- **What if someone only donates?** Capped influence (10%) and availability multiplier still requires broader activity to win.  
- **Small sample outliers?** Shrinkage pulls them toward clan average until they have reps.  
- **New players?** They start near 50; climb fast with cleanups, full participation, and donations.

---

**Bottom line:** ACE gives you a single, fair, predictive number to crown the best **team player**. It’s transparent, hard to game, and encourages exactly the behaviors that make clans win.
