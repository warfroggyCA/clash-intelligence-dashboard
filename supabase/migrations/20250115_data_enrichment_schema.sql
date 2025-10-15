-- Data Enrichment Schema Migration
-- Date: October 12, 2024
-- Adds columns to member_snapshot_stats for historizing:
-- - Pets (JSONB)
-- - Builder Base metrics
-- - War & raid statistics
-- - Troops & spells (aggregated counts)
-- - Achievements (aggregated metrics)
-- - Experience levels
-- 
-- This migration is designed to be:
-- - Idempotent (safe to run multiple times)
-- - Non-breaking (adds columns, doesn't drop/modify existing)
-- - Performant (nullable columns with default NULL)
-- - Rollback-safe (documented rollback script below)

BEGIN;

-- =============================================================================
-- 1️⃣ PETS
-- =============================================================================
-- Store pet levels as JSONB: {"L.A.S.S.I": 10, "Electro Owl": 8, ...}
ALTER TABLE public.member_snapshot_stats
  ADD COLUMN IF NOT EXISTS pet_levels JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS member_snapshot_stats_pet_levels_idx 
  ON public.member_snapshot_stats USING GIN (pet_levels);

COMMENT ON COLUMN public.member_snapshot_stats.pet_levels IS 
  'Pet levels as JSON object: {"petName": level}. Example: {"L.A.S.S.I": 10, "Electro Owl": 8}';

-- =============================================================================
-- 2️⃣ BUILDER BASE / BUILDER HALL
-- =============================================================================
ALTER TABLE public.member_snapshot_stats
  ADD COLUMN IF NOT EXISTS builder_hall_level INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS versus_trophies INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS versus_battle_wins INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS builder_league_id INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS member_snapshot_stats_builder_hall_level_idx 
  ON public.member_snapshot_stats (builder_hall_level);

CREATE INDEX IF NOT EXISTS member_snapshot_stats_versus_trophies_idx 
  ON public.member_snapshot_stats (versus_trophies);

COMMENT ON COLUMN public.member_snapshot_stats.builder_hall_level IS 
  'Builder Hall level (1-10)';
COMMENT ON COLUMN public.member_snapshot_stats.versus_trophies IS 
  'Builder Base trophies (versus battles)';
COMMENT ON COLUMN public.member_snapshot_stats.versus_battle_wins IS 
  'Total versus battle wins';
COMMENT ON COLUMN public.member_snapshot_stats.builder_league_id IS 
  'Builder Base league ID';

-- =============================================================================
-- 3️⃣ WAR & RAID STATISTICS
-- =============================================================================
ALTER TABLE public.member_snapshot_stats
  ADD COLUMN IF NOT EXISTS war_stars INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attack_wins INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS defense_wins INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS capital_contributions INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS member_snapshot_stats_war_stars_idx 
  ON public.member_snapshot_stats (war_stars);

CREATE INDEX IF NOT EXISTS member_snapshot_stats_capital_contributions_idx 
  ON public.member_snapshot_stats (capital_contributions);

COMMENT ON COLUMN public.member_snapshot_stats.war_stars IS 
  'Total war stars earned (cumulative)';
COMMENT ON COLUMN public.member_snapshot_stats.attack_wins IS 
  'Total multiplayer attack wins';
COMMENT ON COLUMN public.member_snapshot_stats.defense_wins IS 
  'Total defense wins';
COMMENT ON COLUMN public.member_snapshot_stats.capital_contributions IS 
  'Total clan capital gold contributed';

-- =============================================================================
-- 4️⃣ TROOPS & SPELLS (AGGREGATED)
-- =============================================================================
-- Store aggregated counts rather than full lists for performance
ALTER TABLE public.member_snapshot_stats
  ADD COLUMN IF NOT EXISTS max_troop_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_spell_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS super_troops_active TEXT[] DEFAULT NULL;

CREATE INDEX IF NOT EXISTS member_snapshot_stats_max_troop_count_idx 
  ON public.member_snapshot_stats (max_troop_count);

COMMENT ON COLUMN public.member_snapshot_stats.max_troop_count IS 
  'Number of troops at max level for current TH';
COMMENT ON COLUMN public.member_snapshot_stats.max_spell_count IS 
  'Number of spells at max level for current TH';
COMMENT ON COLUMN public.member_snapshot_stats.super_troops_active IS 
  'Array of active super troop names (e.g. {"Super Barbarian", "Super Archer"})';

-- =============================================================================
-- 5️⃣ ACHIEVEMENTS (AGGREGATED)
-- =============================================================================
ALTER TABLE public.member_snapshot_stats
  ADD COLUMN IF NOT EXISTS achievement_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS achievement_score INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS member_snapshot_stats_achievement_count_idx 
  ON public.member_snapshot_stats (achievement_count);

COMMENT ON COLUMN public.member_snapshot_stats.achievement_count IS 
  'Number of completed achievements (3-star)';
COMMENT ON COLUMN public.member_snapshot_stats.achievement_score IS 
  'Total achievement stars earned (sum of all achievements)';

-- =============================================================================
-- 6️⃣ EXPERIENCE & PROGRESSION
-- =============================================================================
ALTER TABLE public.member_snapshot_stats
  ADD COLUMN IF NOT EXISTS exp_level INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS best_trophies INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS best_versus_trophies INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS member_snapshot_stats_exp_level_idx 
  ON public.member_snapshot_stats (exp_level);

COMMENT ON COLUMN public.member_snapshot_stats.exp_level IS 
  'Player experience level (1-500+)';
COMMENT ON COLUMN public.member_snapshot_stats.best_trophies IS 
  'All-time highest trophy count';
COMMENT ON COLUMN public.member_snapshot_stats.best_versus_trophies IS 
  'All-time highest Builder Base trophy count';

-- =============================================================================
-- 7️⃣ ENHANCE EQUIPMENT FLAGS
-- =============================================================================
-- No schema change needed - equipment_flags already exists as JSONB
-- We'll enhance the data format to include levels: {"equipmentName": level}
COMMENT ON COLUMN public.member_snapshot_stats.equipment_flags IS 
  'Hero equipment levels as JSON object: {"equipmentName": level}. Example: {"Barbarian Puppet": 18, "Rage Vial": 15}';

COMMIT;

-- =============================================================================
-- ROLLBACK SCRIPT (Keep for reference, don't execute)
-- =============================================================================
/*
BEGIN;

-- Drop indexes
DROP INDEX IF EXISTS public.member_snapshot_stats_pet_levels_idx;
DROP INDEX IF EXISTS public.member_snapshot_stats_builder_hall_level_idx;
DROP INDEX IF EXISTS public.member_snapshot_stats_versus_trophies_idx;
DROP INDEX IF EXISTS public.member_snapshot_stats_war_stars_idx;
DROP INDEX IF EXISTS public.member_snapshot_stats_capital_contributions_idx;
DROP INDEX IF EXISTS public.member_snapshot_stats_max_troop_count_idx;
DROP INDEX IF EXISTS public.member_snapshot_stats_achievement_count_idx;
DROP INDEX IF EXISTS public.member_snapshot_stats_exp_level_idx;

-- Drop columns
ALTER TABLE public.member_snapshot_stats
  DROP COLUMN IF EXISTS pet_levels,
  DROP COLUMN IF EXISTS builder_hall_level,
  DROP COLUMN IF EXISTS versus_trophies,
  DROP COLUMN IF EXISTS versus_battle_wins,
  DROP COLUMN IF EXISTS builder_league_id,
  DROP COLUMN IF EXISTS war_stars,
  DROP COLUMN IF EXISTS attack_wins,
  DROP COLUMN IF EXISTS defense_wins,
  DROP COLUMN IF EXISTS capital_contributions,
  DROP COLUMN IF EXISTS max_troop_count,
  DROP COLUMN IF EXISTS max_spell_count,
  DROP COLUMN IF EXISTS super_troops_active,
  DROP COLUMN IF EXISTS achievement_count,
  DROP COLUMN IF EXISTS achievement_score,
  DROP COLUMN IF EXISTS exp_level,
  DROP COLUMN IF EXISTS best_trophies,
  DROP COLUMN IF EXISTS best_versus_trophies;

COMMIT;
*/

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run these after migration to verify success:
/*
-- 1. Check that all columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'member_snapshot_stats'
  AND column_name IN (
    'pet_levels', 'builder_hall_level', 'versus_trophies', 'versus_battle_wins',
    'builder_league_id', 'war_stars', 'attack_wins', 'defense_wins',
    'capital_contributions', 'max_troop_count', 'max_spell_count',
    'super_troops_active', 'achievement_count', 'achievement_score',
    'exp_level', 'best_trophies', 'best_versus_trophies'
  )
ORDER BY column_name;

-- 2. Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'member_snapshot_stats'
  AND indexname LIKE '%pet%' OR indexname LIKE '%builder%' OR indexname LIKE '%war%'
  OR indexname LIKE '%achievement%' OR indexname LIKE '%exp%' OR indexname LIKE '%troop%';

-- 3. Verify table size impact (should be minimal with NULL defaults)
SELECT
  pg_size_pretty(pg_total_relation_size('public.member_snapshot_stats')) as total_size,
  pg_size_pretty(pg_relation_size('public.member_snapshot_stats')) as table_size,
  pg_size_pretty(pg_indexes_size('public.member_snapshot_stats')) as indexes_size;
*/

