-- CWL Attendance Ledger + Rollups
-- Date: 2026-01-05

BEGIN;

-- ==========================================================================
-- CREATE TABLE: cwl_player_day_activity
-- ==========================================================================
-- Stores per-player attendance for each CWL day (performed vs missed attacks)

CREATE TABLE IF NOT EXISTS public.cwl_player_day_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cwl_season_id UUID NOT NULL REFERENCES public.cwl_seasons(id) ON DELETE CASCADE,
  day_index INT NOT NULL CHECK (day_index >= 1 AND day_index <= 7),

  player_tag TEXT NOT NULL CHECK (player_tag ~ '^#[0289PYLQGRJCUV]{5,}$'),
  player_name TEXT,
  town_hall INT,
  map_position INT,

  attacks_available INT NOT NULL DEFAULT 0 CHECK (attacks_available >= 0),
  attacks_performed INT NOT NULL DEFAULT 0 CHECK (attacks_performed >= 0),
  missed_attacks INT NOT NULL DEFAULT 0 CHECK (missed_attacks >= 0),

  is_our_clan BOOLEAN NOT NULL DEFAULT true,
  war_tag TEXT CHECK (war_tag IS NULL OR war_tag ~ '^#[0289PYLQGRJCUV]{5,}$'),
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(cwl_season_id, day_index, player_tag, is_our_clan)
);

-- ==========================================================================
-- CREATE TABLE: cwl_attendance_rollups
-- ==========================================================================
-- Stores prior-days rollups for lineup planning on a target day

CREATE TABLE IF NOT EXISTS public.cwl_attendance_rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cwl_season_id UUID NOT NULL REFERENCES public.cwl_seasons(id) ON DELETE CASCADE,
  day_index INT NOT NULL CHECK (day_index >= 1 AND day_index <= 7),

  player_tag TEXT NOT NULL CHECK (player_tag ~ '^#[0289PYLQGRJCUV]{5,}$'),
  player_name TEXT,
  town_hall INT,

  total_days INT NOT NULL DEFAULT 0 CHECK (total_days >= 0),
  days_with_data INT NOT NULL DEFAULT 0 CHECK (days_with_data >= 0),
  attacks_available INT NOT NULL DEFAULT 0 CHECK (attacks_available >= 0),
  attacks_performed INT NOT NULL DEFAULT 0 CHECK (attacks_performed >= 0),
  missed_attacks INT NOT NULL DEFAULT 0 CHECK (missed_attacks >= 0),
  participation_rate NUMERIC(5,4) CHECK (participation_rate IS NULL OR (participation_rate >= 0 AND participation_rate <= 1)),

  status TEXT NOT NULL DEFAULT 'unknown',
  last_attack_day INT CHECK (last_attack_day IS NULL OR (last_attack_day >= 1 AND last_attack_day <= 7)),
  last_missed_day INT CHECK (last_missed_day IS NULL OR (last_missed_day >= 1 AND last_missed_day <= 7)),

  computed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(cwl_season_id, day_index, player_tag)
);

-- ==========================================================================
-- INDEXES
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_cwl_player_day_activity_season_day
  ON public.cwl_player_day_activity(cwl_season_id, day_index);

CREATE INDEX IF NOT EXISTS idx_cwl_player_day_activity_player
  ON public.cwl_player_day_activity(player_tag);

CREATE INDEX IF NOT EXISTS idx_cwl_attendance_rollups_season_day
  ON public.cwl_attendance_rollups(cwl_season_id, day_index);

CREATE INDEX IF NOT EXISTS idx_cwl_attendance_rollups_player
  ON public.cwl_attendance_rollups(player_tag);

-- ==========================================================================
-- ROW LEVEL SECURITY
-- ==========================================================================

ALTER TABLE public.cwl_player_day_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cwl_attendance_rollups ENABLE ROW LEVEL SECURITY;

-- cwl_player_day_activity policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_player_day_activity'
      AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON public.cwl_player_day_activity
      FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_player_day_activity'
      AND policyname = 'Authenticated read access'
  ) THEN
    CREATE POLICY "Authenticated read access" ON public.cwl_player_day_activity
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- cwl_attendance_rollups policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_attendance_rollups'
      AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON public.cwl_attendance_rollups
      FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_attendance_rollups'
      AND policyname = 'Authenticated read access'
  ) THEN
    CREATE POLICY "Authenticated read access" ON public.cwl_attendance_rollups
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

COMMIT;
