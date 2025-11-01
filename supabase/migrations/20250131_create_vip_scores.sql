-- Migration: Create VIP Scores Table
-- Date: 2025-01-31
-- Purpose: Replace WCI with VIP Score (Very Important Player)
-- 
-- VIP Score Components:
-- Competitive Performance (50%): Ranked (LAI, TPG) + War (OVA, DVA)
-- Support Performance (30%): Donations + Capital
-- Development Performance (20%): Base Quality (PDR) + Activity

BEGIN;

-- Create vip_scores table
CREATE TABLE IF NOT EXISTS public.vip_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  
  -- Tournament Week Period (Tuesday 5 AM UTC → Monday 5 AM UTC)
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Competitive Performance (50% weight)
  -- Ranked Components (60% of Competitive)
  lai DECIMAL(5,2),              -- League Advancement Index (0-100)
  tpg DECIMAL(5,2),              -- Trophy Progression Gain (0-100)
  ranked_score DECIMAL(5,2),    -- Combined Ranked Score (0-100)
  
  -- War Components (40% of Competitive)
  war_ova DECIMAL(5,2),          -- Offense Value Above Expectation (z-score)
  war_dva DECIMAL(5,2),          -- Defense Value Above Expectation (z-score)
  war_score DECIMAL(5,2),       -- Combined War Score (0-100)
  competitive_score DECIMAL(5,2), -- Combined Competitive Score (0-100)
  
  -- Support Performance (30% weight)
  donations DECIMAL(5,2),        -- Donation Support Score (0-100)
  capital DECIMAL(5,2),          -- Capital Support Score (0-100)
  support_score DECIMAL(5,2),   -- Combined Support Score (0-100)
  
  -- Development Performance (20% weight)
  base_quality DECIMAL(5,2),    -- PDR Score (0-100)
  activity DECIMAL(5,2),         -- Activity Score (0-100)
  hero_progression DECIMAL(5,2), -- Hero Upgrade Score (0-100)
  development_score DECIMAL(5,2), -- Combined Development Score (0-100)
  
  -- Final VIP Score (0-100)
  vip_score DECIMAL(5,2) NOT NULL,
  
  -- Metadata for calculations and context
  ranked_trophies_start INTEGER,
  ranked_trophies_end INTEGER,
  league_tier_start INTEGER,
  league_tier_end INTEGER,
  league_name_start TEXT,
  league_name_end TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one score per member per week
  UNIQUE(member_id, week_start)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vip_scores_week ON public.vip_scores(week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_vip_scores_score ON public.vip_scores(vip_score DESC);
CREATE INDEX IF NOT EXISTS idx_vip_scores_member ON public.vip_scores(member_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_vip_scores_current ON public.vip_scores(week_start DESC, vip_score DESC);

-- Add comments
COMMENT ON TABLE public.vip_scores IS 
  'VIP (Very Important Player) scores measuring comprehensive clan contribution';
COMMENT ON COLUMN public.vip_scores.competitive_score IS 
  'Competitive Performance: (0.60 × ranked_score) + (0.40 × war_score)';
COMMENT ON COLUMN public.vip_scores.support_score IS 
  'Support Performance: (0.60 × donations) + (0.40 × capital)';
COMMENT ON COLUMN public.vip_scores.development_score IS 
  'Development Performance: (0.40 × base_quality) + (0.30 × activity) + (0.30 × hero_progression)';
COMMENT ON COLUMN public.vip_scores.vip_score IS 
  'Final VIP Score: (0.50 × competitive_score) + (0.30 × support_score) + (0.20 × development_score)';

COMMIT;

