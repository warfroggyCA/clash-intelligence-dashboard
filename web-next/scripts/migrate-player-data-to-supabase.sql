-- Migration script to set up Supabase tables for player data
-- Run this in your Supabase SQL editor

-- 1. Create player_notes table (if not exists)
CREATE TABLE IF NOT EXISTS public.player_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL,
  player_tag TEXT NOT NULL,
  player_name TEXT,
  note TEXT NOT NULL,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT, -- user identifier
  UNIQUE(clan_tag, player_tag, created_at) -- Prevent exact duplicates
);

-- 2. Create player_warnings table
CREATE TABLE IF NOT EXISTS public.player_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL,
  player_tag TEXT NOT NULL,
  player_name TEXT,
  warning_note TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT, -- user identifier
  UNIQUE(clan_tag, player_tag) -- One active warning per player
);

-- 3. Create player_tenure_actions table
CREATE TABLE IF NOT EXISTS public.player_tenure_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL,
  player_tag TEXT NOT NULL,
  player_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
  reason TEXT,
  granted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT -- user identifier
);

-- 4. Create player_departure_actions table
CREATE TABLE IF NOT EXISTS public.player_departure_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL,
  player_tag TEXT NOT NULL,
  player_name TEXT,
  reason TEXT NOT NULL,
  departure_type TEXT NOT NULL CHECK (departure_type IN ('voluntary', 'involuntary', 'inactive')),
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT -- user identifier
);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_player_notes_clan_tag ON public.player_notes(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_notes_player_tag ON public.player_notes(player_tag);
CREATE INDEX IF NOT EXISTS idx_player_notes_created_at ON public.player_notes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_warnings_clan_tag ON public.player_warnings(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_warnings_player_tag ON public.player_warnings(player_tag);
CREATE INDEX IF NOT EXISTS idx_player_warnings_is_active ON public.player_warnings(is_active);

CREATE INDEX IF NOT EXISTS idx_player_tenure_actions_clan_tag ON public.player_tenure_actions(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_tenure_actions_player_tag ON public.player_tenure_actions(player_tag);
CREATE INDEX IF NOT EXISTS idx_player_tenure_actions_created_at ON public.player_tenure_actions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_departure_actions_clan_tag ON public.player_departure_actions(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_departure_actions_player_tag ON public.player_departure_actions(player_tag);
CREATE INDEX IF NOT EXISTS idx_player_departure_actions_created_at ON public.player_departure_actions(created_at DESC);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.player_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_tenure_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_departure_actions ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies (allow all for now, can be restricted later)
CREATE POLICY "Allow all operations on player_notes" ON public.player_notes FOR ALL USING (true);
CREATE POLICY "Allow all operations on player_warnings" ON public.player_warnings FOR ALL USING (true);
CREATE POLICY "Allow all operations on player_tenure_actions" ON public.player_tenure_actions FOR ALL USING (true);
CREATE POLICY "Allow all operations on player_departure_actions" ON public.player_departure_actions FOR ALL USING (true);

-- 8. Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Create triggers for updated_at
DROP TRIGGER IF EXISTS update_player_notes_updated_at ON public.player_notes;
CREATE TRIGGER update_player_notes_updated_at
    BEFORE UPDATE ON public.player_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_player_warnings_updated_at ON public.player_warnings;
CREATE TRIGGER update_player_warnings_updated_at
    BEFORE UPDATE ON public.player_warnings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
