-- CWL Attack Results Table
-- Stores individual attack results for detailed performance tracking
-- Date: 2026-01-03

BEGIN;

-- ============================================================================
-- CREATE TABLE: cwl_attack_results
-- ============================================================================
-- Stores each individual attack in a CWL war for performance analysis
-- Used to inform future day planning (e.g., "Player X struggles vs TH16")

CREATE TABLE IF NOT EXISTS public.cwl_attack_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cwl_season_id UUID NOT NULL REFERENCES public.cwl_seasons(id) ON DELETE CASCADE,
  day_index INT NOT NULL CHECK (day_index >= 1 AND day_index <= 7),
  
  -- Attacker info
  attacker_tag TEXT NOT NULL CHECK (attacker_tag ~ '^#[0289PYLQGRJCUV]{5,}$'),
  attacker_name TEXT,
  attacker_th INT,
  attacker_map_position INT,
  
  -- Defender info  
  defender_tag TEXT CHECK (defender_tag IS NULL OR defender_tag ~ '^#[0289PYLQGRJCUV]{5,}$'),
  defender_name TEXT,
  defender_th INT,
  defender_map_position INT,
  
  -- Attack results
  stars INT CHECK (stars >= 0 AND stars <= 3),
  destruction_pct DECIMAL(5,2) CHECK (destruction_pct >= 0 AND destruction_pct <= 100),
  attack_order INT NOT NULL CHECK (attack_order >= 1 AND attack_order <= 2), -- 1st or 2nd attack
  attack_performed BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  is_our_attack BOOLEAN NOT NULL DEFAULT true, -- true = our attack, false = opponent attack
  war_tag TEXT CHECK (war_tag IS NULL OR war_tag ~ '^#[0289PYLQGRJCUV]{5,}$'), -- CoC war tag for reference
  fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one record per attacker per attack order per day
  UNIQUE(cwl_season_id, day_index, attacker_tag, attack_order, is_our_attack),
  CHECK (
    (attack_performed AND defender_tag IS NOT NULL AND stars IS NOT NULL)
    OR (NOT attack_performed AND defender_tag IS NULL AND stars IS NULL AND destruction_pct IS NULL)
  )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- For querying attacks by day
CREATE INDEX IF NOT EXISTS idx_cwl_attack_results_season_day 
  ON public.cwl_attack_results(cwl_season_id, day_index);

-- For querying a player's attack history
CREATE INDEX IF NOT EXISTS idx_cwl_attack_results_attacker 
  ON public.cwl_attack_results(attacker_tag);

-- For finding attacks against specific THs
CREATE INDEX IF NOT EXISTS idx_cwl_attack_results_defender_th 
  ON public.cwl_attack_results(defender_th);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.cwl_attack_results ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to keep this migration idempotent
DROP POLICY IF EXISTS "Service role full access" ON public.cwl_attack_results;
DROP POLICY IF EXISTS "Authenticated read access" ON public.cwl_attack_results;

-- Service role (backend API) has full access
CREATE POLICY "Service role full access" ON public.cwl_attack_results
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read
CREATE POLICY "Authenticated read access" ON public.cwl_attack_results
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- ADD COLUMNS TO cwl_day_results IF NOT EXISTS
-- ============================================================================
-- Add war metadata columns for tracking

DO $$
BEGIN
  -- Add war_tag column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'cwl_day_results' 
      AND column_name = 'war_tag'
  ) THEN
    ALTER TABLE public.cwl_day_results ADD COLUMN war_tag TEXT;
  END IF;
  
  -- Add war_state column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'cwl_day_results' 
      AND column_name = 'war_state'
  ) THEN
    ALTER TABLE public.cwl_day_results ADD COLUMN war_state TEXT;
  END IF;
  
  -- Add opponent_tag column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'cwl_day_results' 
      AND column_name = 'opponent_tag'
  ) THEN
    ALTER TABLE public.cwl_day_results ADD COLUMN opponent_tag TEXT;
  END IF;
  
  -- Add opponent_name column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'cwl_day_results' 
      AND column_name = 'opponent_name'
  ) THEN
    ALTER TABLE public.cwl_day_results ADD COLUMN opponent_name TEXT;
  END IF;
  
  -- Add fetched_at column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'cwl_day_results' 
      AND column_name = 'fetched_at'
  ) THEN
    ALTER TABLE public.cwl_day_results ADD COLUMN fetched_at TIMESTAMPTZ;
  END IF;
  
  -- Add attacks_used column if not exists (how many attacks our clan used)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'cwl_day_results' 
      AND column_name = 'our_attacks_used'
  ) THEN
    ALTER TABLE public.cwl_day_results ADD COLUMN our_attacks_used INT;
  END IF;
  
  -- Add opponent attacks used
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'cwl_day_results' 
      AND column_name = 'opponent_attacks_used'
  ) THEN
    ALTER TABLE public.cwl_day_results ADD COLUMN opponent_attacks_used INT;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run after migration:
-- SELECT * FROM public.cwl_attack_results LIMIT 1;
-- \d public.cwl_attack_results
-- \d public.cwl_day_results
