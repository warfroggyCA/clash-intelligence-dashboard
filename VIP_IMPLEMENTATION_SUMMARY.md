# VIP Score Implementation Summary

**Date:** January 31, 2025
**Status:** ✅ Complete - WCI replaced with VIP Score

---

## What Was Done

### 1. ✅ VIP Score Calculation Logic
- **File:** `web-next/src/lib/metrics/vip.ts`
- **Purpose:** Core VIP calculation functions
- **Components:**
  - Competitive Performance (50%): Ranked (LAI, TPG) + War (OVA, DVA)
  - Support Performance (30%): Donations + Capital Contributions
  - Development Performance (20%): Base Quality (PDR) + Activity

### 2. ✅ Database Schema
- **File:** `supabase/migrations/20250131_create_vip_scores.sql`
- **Table:** `vip_scores`
- **Columns:** All VIP components stored with proper indexes

### 3. ✅ Ingestion Pipeline
- **File:** `web-next/src/lib/ingestion/calculate-vip.ts`
- **Integration:** `web-next/src/lib/ingestion/staged-pipeline.ts`
- **Behavior:** Calculates VIP scores after Monday snapshots (replaces WCI phase)

### 4. ✅ API Endpoints
- **Roster API:** `web-next/src/app/api/v2/roster/route.ts`
  - Returns VIP scores with competitive/support/development breakdown
  - Includes trend calculation (up/down/stable)
- **Player Profile API:** `web-next/src/app/api/player/[tag]/profile/route.ts`
  - Returns current VIP score and 8-week history

### 5. ✅ UI Components
- **Roster Page:** `web-next/src/app/simple-roster/RosterPage.tsx`
  - VIP column header (sortable)
  - VIP display in desktop table
  - VIP display in mobile cards
  - Tooltips showing component breakdown
- **Player Profile:** `web-next/src/app/player/[tag]/PlayerProfileClient.tsx`
  - VIP score display in profile overview
- **Transform Layer:** `web-next/src/app/simple-roster/roster-transform.ts`
  - Updated interface to use VIP instead of WCI

### 6. ✅ Manual Calculation Script
- **File:** `web-next/scripts/calculate-vip.ts`
- **Usage:** `tsx scripts/calculate-vip.ts 2025-10-27`
- **Purpose:** Manual VIP calculation for testing/historical data

---

## VIP Score Formula

```
VIP = (0.50 × Competitive) + (0.30 × Support) + (0.20 × Development)
```

**Competitive (50%):**
- Ranked Performance (60%): LAI (70%) + TPG (30%)
- War Performance (40%): OVA (60%) + DVA (40%)

**Support (30%):**
- Donations (60%): Uses existing donation calculation
- Capital (40%): Week-over-week capital contributions delta

**Development (20%):**
- Base Quality (50%): PDR (100 - rushPercent)
- Activity (50%): Capital delta + Achievement delta + War participation

---

## Key Improvements Over WCI

1. **War Performance Integration** - Incorporates ACE war components (OVA/DVA)
2. **Capital Tracking** - Week-over-week capital contributions delta
3. **Improved Activity** - Removes duplication, adds capital/achievement/war metrics
4. **Broader Scope** - Measures all-mode contribution, not just ranked

---

## Next Steps

1. **Run Migration:** Apply `supabase/migrations/20250131_create_vip_scores.sql` to create table
2. **Calculate Initial Scores:** Run `tsx scripts/calculate-vip.ts 2025-10-27` for existing Monday snapshot
3. **Verify Display:** Check roster page and player profiles show VIP scores correctly
4. **Monitor:** Next Monday snapshot will automatically calculate VIP scores

---

## Files Changed

### Created:
- `web-next/src/lib/metrics/vip.ts`
- `web-next/src/lib/ingestion/calculate-vip.ts`
- `web-next/scripts/calculate-vip.ts`
- `supabase/migrations/20250131_create_vip_scores.sql`
- `VIP_SCORE_SPECIFICATION.md`

### Modified:
- `web-next/src/lib/ingestion/staged-pipeline.ts`
- `web-next/src/app/api/v2/roster/route.ts`
- `web-next/src/app/api/player/[tag]/profile/route.ts`
- `web-next/src/app/simple-roster/RosterPage.tsx`
- `web-next/src/app/simple-roster/roster-transform.ts`
- `web-next/src/app/player/[tag]/PlayerProfileClient.tsx`

### Deprecated (Not Deleted):
- `web-next/src/lib/metrics/wci.ts` - Still exists for reference
- `web-next/src/lib/ingestion/calculate-wci.ts` - Still exists for reference
- `web-next/scripts/calculate-wci.ts` - Still exists for reference
- `supabase/migrations/20250126_create_wci_scores.sql` - Database table still exists

---

## Notes

- WCI code is not deleted, just replaced in active usage
- VIP scores will be calculated automatically on Monday snapshots
- War performance (OVA/DVA) defaults to neutral (50) if not available
- All VIP calculations use only API-available data (no estimates)

