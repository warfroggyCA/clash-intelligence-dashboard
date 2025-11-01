-- Create Player Database Tables Migration
-- Date: January 27, 2025
-- Creates tables for player notes, warnings, tenure actions, and departure actions
-- 
-- This migration is idempotent (safe to run multiple times)

BEGIN;

-- =============================================================================
-- 1️⃣ PLAYER NOTES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.player_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL,
  player_tag TEXT NOT NULL,
  player_name TEXT,
  note TEXT NOT NULL,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  UNIQUE(clan_tag, player_tag, created_at)
);

-- Add archive columns if they don't exist
ALTER TABLE public.player_notes
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_player_notes_clan_tag ON public.player_notes(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_notes_player_tag ON public.player_notes(player_tag);
CREATE INDEX IF NOT EXISTS idx_player_notes_created_at ON public.player_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS player_notes_archived_at_idx ON public.player_notes (archived_at);
CREATE INDEX IF NOT EXISTS player_notes_archived_by_idx ON public.player_notes (archived_by);

COMMENT ON TABLE public.player_notes IS 'Stores player notes with timestamps and custom fields';
COMMENT ON COLUMN public.player_notes.archived_at IS 'Timestamp when the note was archived (NULL = not archived)';
COMMENT ON COLUMN public.player_notes.archived_by IS 'User who archived the note (NULL = not archived)';

-- =============================================================================
-- 2️⃣ PLAYER WARNINGS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.player_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL,
  player_tag TEXT NOT NULL,
  player_name TEXT,
  warning_note TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  UNIQUE(clan_tag, player_tag)
);

-- Add archive columns if they don't exist
ALTER TABLE public.player_warnings
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_player_warnings_clan_tag ON public.player_warnings(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_warnings_player_tag ON public.player_warnings(player_tag);
CREATE INDEX IF NOT EXISTS idx_player_warnings_is_active ON public.player_warnings(is_active);
CREATE INDEX IF NOT EXISTS player_warnings_archived_at_idx ON public.player_warnings (archived_at);
CREATE INDEX IF NOT EXISTS player_warnings_archived_by_idx ON public.player_warnings (archived_by);

COMMENT ON TABLE public.player_warnings IS 'Stores warning notes for returning players';
COMMENT ON COLUMN public.player_warnings.archived_at IS 'Timestamp when the warning was archived (NULL = not archived)';
COMMENT ON COLUMN public.player_warnings.archived_by IS 'User who archived the warning (NULL = not archived)';

-- =============================================================================
-- 3️⃣ PLAYER TENURE ACTIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.player_tenure_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL,
  player_tag TEXT NOT NULL,
  player_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
  reason TEXT,
  granted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

-- Add tenure_days and as_of columns if they don't exist
ALTER TABLE public.player_tenure_actions
  ADD COLUMN IF NOT EXISTS tenure_days INTEGER,
  ADD COLUMN IF NOT EXISTS as_of DATE;

-- Add archive columns if they don't exist
ALTER TABLE public.player_tenure_actions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_player_tenure_actions_clan_tag ON public.player_tenure_actions(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_tenure_actions_player_tag ON public.player_tenure_actions(player_tag);
CREATE INDEX IF NOT EXISTS idx_player_tenure_actions_created_at ON public.player_tenure_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS player_tenure_actions_archived_at_idx ON public.player_tenure_actions (archived_at);
CREATE INDEX IF NOT EXISTS player_tenure_actions_archived_by_idx ON public.player_tenure_actions (archived_by);

COMMENT ON TABLE public.player_tenure_actions IS 'Stores tenure granted/revoked actions';
COMMENT ON COLUMN public.player_tenure_actions.archived_at IS 'Timestamp when the tenure action was archived (NULL = not archived)';
COMMENT ON COLUMN public.player_tenure_actions.archived_by IS 'User who archived the tenure action (NULL = not archived)';

-- =============================================================================
-- 4️⃣ PLAYER DEPARTURE ACTIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.player_departure_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL,
  player_tag TEXT NOT NULL,
  player_name TEXT,
  reason TEXT NOT NULL,
  departure_type TEXT NOT NULL CHECK (departure_type IN ('voluntary', 'involuntary', 'inactive')),
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

-- Add archive columns if they don't exist
ALTER TABLE public.player_departure_actions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_player_departure_actions_clan_tag ON public.player_departure_actions(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_departure_actions_player_tag ON public.player_departure_actions(player_tag);
CREATE INDEX IF NOT EXISTS idx_player_departure_actions_created_at ON public.player_departure_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS player_departure_actions_archived_at_idx ON public.player_departure_actions (archived_at);
CREATE INDEX IF NOT EXISTS player_departure_actions_archived_by_idx ON public.player_departure_actions (archived_by);

COMMENT ON TABLE public.player_departure_actions IS 'Stores departure recordings';
COMMENT ON COLUMN public.player_departure_actions.archived_at IS 'Timestamp when the departure action was archived (NULL = not archived)';
COMMENT ON COLUMN public.player_departure_actions.archived_by IS 'User who archived the departure action (NULL = not archived)';

-- =============================================================================
-- 5️⃣ ENABLE ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.player_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_tenure_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_departure_actions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6️⃣ CREATE RLS POLICIES
-- =============================================================================
-- Allow all operations for service role
DO $$
BEGIN
  -- Player Notes Policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'player_notes' 
    AND policyname = 'Allow all operations on player_notes'
  ) THEN
    CREATE POLICY "Allow all operations on player_notes" 
      ON public.player_notes FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Player Warnings Policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'player_warnings' 
    AND policyname = 'Allow all operations on player_warnings'
  ) THEN
    CREATE POLICY "Allow all operations on player_warnings" 
      ON public.player_warnings FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Player Tenure Actions Policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'player_tenure_actions' 
    AND policyname = 'Allow all operations on player_tenure_actions'
  ) THEN
    CREATE POLICY "Allow all operations on player_tenure_actions" 
      ON public.player_tenure_actions FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Player Departure Actions Policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'player_departure_actions' 
    AND policyname = 'Allow all operations on player_departure_actions'
  ) THEN
    CREATE POLICY "Allow all operations on player_departure_actions" 
      ON public.player_departure_actions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

