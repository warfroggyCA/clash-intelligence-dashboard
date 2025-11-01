-- Migration: Add hero_progression column to vip_scores table
-- Date: 2025-01-31
-- Purpose: Track hero upgrades as part of development performance

BEGIN;

-- Add hero_progression column
ALTER TABLE public.vip_scores
ADD COLUMN IF NOT EXISTS hero_progression DECIMAL(5,2);

-- Update comment
COMMENT ON COLUMN public.vip_scores.hero_progression IS 
  'Hero Upgrade Score: Measures hero upgrades week-over-week (0-100)';

-- Update development_score comment to reflect new formula
COMMENT ON COLUMN public.vip_scores.development_score IS 
  'Development Performance: (0.40 × base_quality) + (0.30 × activity) + (0.30 × hero_progression)';

COMMIT;

