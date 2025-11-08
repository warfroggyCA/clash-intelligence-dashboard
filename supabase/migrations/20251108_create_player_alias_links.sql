-- Create Player Alias Links Table Migration
-- Date: November 8, 2025
-- Creates table for linking separate player accounts (aliases) owned by the same person
-- 
-- This migration is idempotent (safe to run multiple times)

BEGIN;

-- =============================================================================
-- PLAYER ALIAS LINKS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.player_alias_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL,
  player_tag_1 TEXT NOT NULL,
  player_tag_2 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  -- Ensure tag1 < tag2 to prevent duplicate bidirectional relationships
  CHECK (player_tag_1 < player_tag_2),
  -- Prevent self-links
  CHECK (player_tag_1 != player_tag_2),
  -- Unique constraint ensures no duplicate links
  UNIQUE(clan_tag, player_tag_1, player_tag_2)
);

-- Create indexes for fast lookups in both directions
CREATE INDEX IF NOT EXISTS idx_player_alias_links_clan_tag ON public.player_alias_links(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_alias_links_tag_1 ON public.player_alias_links(clan_tag, player_tag_1);
CREATE INDEX IF NOT EXISTS idx_player_alias_links_tag_2 ON public.player_alias_links(clan_tag, player_tag_2);

-- Composite index for bidirectional queries
CREATE INDEX IF NOT EXISTS idx_player_alias_links_bidirectional 
  ON public.player_alias_links(clan_tag, player_tag_1, player_tag_2);

COMMENT ON TABLE public.player_alias_links IS 'Stores bidirectional relationships between separate player accounts (aliases) owned by the same person. Relationships are stored with player_tag_1 < player_tag_2 to prevent duplicates.';
COMMENT ON COLUMN public.player_alias_links.player_tag_1 IS 'First player tag (must be lexicographically less than player_tag_2)';
COMMENT ON COLUMN public.player_alias_links.player_tag_2 IS 'Second player tag (must be lexicographically greater than player_tag_1)';
COMMENT ON COLUMN public.player_alias_links.created_by IS 'User identifier who created the alias link';

-- Enable Row Level Security
ALTER TABLE public.player_alias_links ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security requirements)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'player_alias_links'
      AND policyname = 'Allow all operations on player_alias_links'
  ) THEN
    CREATE POLICY "Allow all operations on player_alias_links"
      ON public.player_alias_links
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

COMMIT;

