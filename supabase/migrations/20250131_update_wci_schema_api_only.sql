-- Migration: Update WCI schema to match API-available data only
-- Date: 2025-01-31
-- Purpose: Remove tournament-specific components, use only API-available data
--
-- Changes:
-- CP Components: tur, tte, lai, drs → tpg, lai, tef
-- PS Components: pdr, donation_support, sbc → pdr, donation_support, activity
-- Remove: attacks_used, attacks_allowed, promotion_status (not available from API)

BEGIN;

-- Add new columns for CP components
ALTER TABLE public.wci_scores 
  ADD COLUMN IF NOT EXISTS tpg DECIMAL(5,2),  -- Trophy Progression Gain
  ADD COLUMN IF NOT EXISTS tef DECIMAL(5,2);  -- Trophy Efficiency Factor

-- Add new column for PS component
ALTER TABLE public.wci_scores 
  ADD COLUMN IF NOT EXISTS activity DECIMAL(5,2);  -- Weekly Activity Score

-- Update comments
COMMENT ON COLUMN public.wci_scores.tpg IS 
  'Trophy Progression Gain: Trophy delta normalized to 0-100 scale';
  
COMMENT ON COLUMN public.wci_scores.tef IS 
  'Trophy Efficiency Factor: Trophy count relative to tier-specific maximum';
  
COMMENT ON COLUMN public.wci_scores.activity IS 
  'Weekly Activity Score: Based on donations and trophy changes (0-100)';

-- Mark old columns as deprecated (keep for now for backwards compatibility)
COMMENT ON COLUMN public.wci_scores.tur IS 
  'DEPRECATED: Tournament Utilization Rate (not available from API)';
  
COMMENT ON COLUMN public.wci_scores.tte IS 
  'DEPRECATED: Tournament Trophy Efficiency (not available from API)';
  
COMMENT ON COLUMN public.wci_scores.drs IS 
  'DEPRECATED: Defense Resilience Score (not available from API)';
  
COMMENT ON COLUMN public.wci_scores.sbc IS 
  'DEPRECATED: Star Bonus Completion (not available from API, replaced by activity)';
  
COMMENT ON COLUMN public.wci_scores.attacks_used IS 
  'DEPRECATED: Not available from API';
  
COMMENT ON COLUMN public.wci_scores.attacks_allowed IS 
  'DEPRECATED: Not available from API';
  
COMMENT ON COLUMN public.wci_scores.promotion_status IS 
  'DEPRECATED: Inferred from league tier changes instead';

COMMIT;

