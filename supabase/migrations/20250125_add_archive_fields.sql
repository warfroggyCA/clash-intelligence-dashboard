-- Add Archive Fields Migration
-- Date: January 25, 2025
-- Adds archive functionality to player_notes, player_tenure_actions, and player_departure_actions tables
-- 
-- This migration is designed to be:
-- - Idempotent (safe to run multiple times)
-- - Non-breaking (adds columns, doesn't drop/modify existing)
-- - Performant (nullable columns with default NULL)
-- - Rollback-safe (documented rollback script below)

BEGIN;

-- =============================================================================
-- 1️⃣ PLAYER NOTES ARCHIVE FIELDS
-- =============================================================================
ALTER TABLE public.player_notes
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS player_notes_archived_at_idx 
  ON public.player_notes (archived_at);

CREATE INDEX IF NOT EXISTS player_notes_archived_by_idx 
  ON public.player_notes (archived_by);

COMMENT ON COLUMN public.player_notes.archived_at IS 
  'Timestamp when the note was archived (NULL = not archived)';
COMMENT ON COLUMN public.player_notes.archived_by IS 
  'User who archived the note (NULL = not archived)';

-- =============================================================================
-- 2️⃣ PLAYER TENURE ACTIONS ARCHIVE FIELDS
-- =============================================================================
ALTER TABLE public.player_tenure_actions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS player_tenure_actions_archived_at_idx 
  ON public.player_tenure_actions (archived_at);

CREATE INDEX IF NOT EXISTS player_tenure_actions_archived_by_idx 
  ON public.player_tenure_actions (archived_by);

COMMENT ON COLUMN public.player_tenure_actions.archived_at IS 
  'Timestamp when the tenure action was archived (NULL = not archived)';
COMMENT ON COLUMN public.player_tenure_actions.archived_by IS 
  'User who archived the tenure action (NULL = not archived)';

-- =============================================================================
-- 3️⃣ PLAYER DEPARTURE ACTIONS ARCHIVE FIELDS
-- =============================================================================
ALTER TABLE public.player_departure_actions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS player_departure_actions_archived_at_idx 
  ON public.player_departure_actions (archived_at);

CREATE INDEX IF NOT EXISTS player_departure_actions_archived_by_idx 
  ON public.player_departure_actions (archived_by);

COMMENT ON COLUMN public.player_departure_actions.archived_at IS 
  'Timestamp when the departure action was archived (NULL = not archived)';
COMMENT ON COLUMN public.player_departure_actions.archived_by IS 
  'User who archived the departure action (NULL = not archived)';

COMMIT;

-- =============================================================================
-- ROLLBACK SCRIPT (Keep for reference, don't execute)
-- =============================================================================
/*
BEGIN;

-- Drop indexes
DROP INDEX IF EXISTS public.player_notes_archived_at_idx;
DROP INDEX IF EXISTS public.player_notes_archived_by_idx;
DROP INDEX IF EXISTS public.player_tenure_actions_archived_at_idx;
DROP INDEX IF EXISTS public.player_tenure_actions_archived_by_idx;
DROP INDEX IF EXISTS public.player_departure_actions_archived_at_idx;
DROP INDEX IF EXISTS public.player_departure_actions_archived_by_idx;

-- Drop columns
ALTER TABLE public.player_notes
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS archived_by;

ALTER TABLE public.player_tenure_actions
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS archived_by;

ALTER TABLE public.player_departure_actions
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS archived_by;

COMMIT;
*/

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run these after migration to verify success:
/*
-- 1. Check that all columns were added
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('player_notes', 'player_tenure_actions', 'player_departure_actions')
  AND column_name IN ('archived_at', 'archived_by')
ORDER BY table_name, column_name;

-- 2. Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('player_notes', 'player_tenure_actions', 'player_departure_actions')
  AND indexname LIKE '%archived%';

-- 3. Verify table size impact (should be minimal with NULL defaults)
SELECT
  'player_notes' as table_name,
  pg_size_pretty(pg_total_relation_size('public.player_notes')) as total_size
UNION ALL
SELECT
  'player_tenure_actions' as table_name,
  pg_size_pretty(pg_total_relation_size('public.player_tenure_actions')) as total_size
UNION ALL
SELECT
  'player_departure_actions' as table_name,
  pg_size_pretty(pg_total_relation_size('public.player_departure_actions')) as total_size;
*/

