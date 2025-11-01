-- Weekly Competitive Index (WCI) Scores Table
-- Date: January 26, 2025
-- Purpose: Store weekly WCI calculations for competitive performance tracking
--
-- WCI = (0.60 × CP) + (0.40 × PS)
-- Where CP = Competitive Performance (Ranked Mode)
--       PS = Progression & Support (Farming/Clan activities)
--
-- This migration is designed to be:
-- - Idempotent (safe to run multiple times)
-- - Non-breaking (new table, no modifications to existing tables)
-- - Performant (indexes for fast queries)

BEGIN;

-- Create WCI scores table
CREATE TABLE IF NOT EXISTS public.wci_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  
  -- Tournament Week Period (Tuesday 5 AM UTC → Monday 5 AM UTC)
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Competitive Performance (CP) Components (60% weight)
  tur DECIMAL(5,2),              -- Tournament Utilization Rate (0-100)
  tte DECIMAL(5,2),              -- Tournament Trophy Efficiency (0-100)
  lai DECIMAL(5,2),              -- League Advancement Index (0-100)
  drs DECIMAL(5,2),              -- Defense Resilience Score (0-100)
  cp_score DECIMAL(5,2),         -- Combined CP Score (0-100)
  
  -- Progression & Support (PS) Components (40% weight)
  pdr DECIMAL(5,2),              -- Progression Debt Reduction (0-100)
  donation_support DECIMAL(5,2), -- Donation & Resource Support (0-100)
  sbc DECIMAL(5,2),              -- Star Bonus Completion (0-100)
  ps_score DECIMAL(5,2),         -- Combined PS Score (0-100)
  
  -- Final WCI Score (0-100)
  wci_score DECIMAL(5,2) NOT NULL,
  
  -- Metadata for calculations and context
  ranked_trophies_start INTEGER,  -- Trophies at week start
  ranked_trophies_end INTEGER,    -- Trophies at week end
  attacks_used INTEGER,           -- Attacks used this week
  attacks_allowed INTEGER,        -- Attacks allowed (based on league tier)
  league_tier_start INTEGER,      -- League tier at week start
  league_tier_end INTEGER,        -- League tier at week end
  league_name_start TEXT,         -- League name at week start
  league_name_end TEXT,           -- League name at week end
  promotion_status TEXT,          -- 'promoted', 'retained', 'demoted', 'decay', null
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one score per member per week
  UNIQUE(member_id, week_start)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_wci_scores_week ON public.wci_scores(week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_wci_scores_score ON public.wci_scores(wci_score DESC);
CREATE INDEX IF NOT EXISTS idx_wci_scores_member ON public.wci_scores(member_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_wci_scores_current ON public.wci_scores(week_start DESC, wci_score DESC);

-- Add helpful comments
COMMENT ON TABLE public.wci_scores IS 
  'Weekly Competitive Index scores calculated after tournament reset (Monday 5 AM UTC)';
  
COMMENT ON COLUMN public.wci_scores.week_start IS 
  'Tournament week start date (Tuesday 5 AM UTC)';
  
COMMENT ON COLUMN public.wci_scores.week_end IS 
  'Tournament week end date (Monday 5 AM UTC)';
  
COMMENT ON COLUMN public.wci_scores.wci_score IS 
  'Final WCI score: (0.60 × cp_score) + (0.40 × ps_score), range 0-100';
  
COMMENT ON COLUMN public.wci_scores.tur IS 
  'Tournament Utilization Rate: attacks_used / attacks_allowed × 100';
  
COMMENT ON COLUMN public.wci_scores.tte IS 
  'Tournament Trophy Efficiency: (offTrophies + defTrophies) / maxPotential × 100';
  
COMMENT ON COLUMN public.wci_scores.lai IS 
  'League Advancement Index: Score for promotion/retention/demotion';
  
COMMENT ON COLUMN public.wci_scores.drs IS 
  'Defense Resilience Score: defTrophies / potentialDefenseLosses × 100';

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_wci_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_wci_scores_updated_at
  BEFORE UPDATE ON public.wci_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_wci_scores_updated_at();

-- Grant permissions (adjust based on your RLS policy needs)
-- ALTER TABLE public.wci_scores ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Rollback script (if needed):
-- DROP TABLE IF EXISTS public.wci_scores CASCADE;
-- DROP FUNCTION IF EXISTS update_wci_scores_updated_at() CASCADE;

