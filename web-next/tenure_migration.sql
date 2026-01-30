-- Supabase Migration: Add tenure columns to members and snapshots
-- Run this in the Supabase SQL Editor

-- 1. Add columns to public.members table
-- Note: 'members' table isn't in your schema.sql but referenced in HANDOFF
-- We'll add them to both 'members' (if exists) and 'clan_snapshots' components

-- Check if 'members' table exists and add columns
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'members') THEN
        ALTER TABLE public.members 
            ADD COLUMN IF NOT EXISTS tenure_days INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS tenure_as_of DATE;
    END IF;
END $$;

-- 2. Add columns to member_snapshot_stats (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'member_snapshot_stats') THEN
        ALTER TABLE public.member_snapshot_stats 
            ADD COLUMN IF NOT EXISTS tenure_days INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS tenure_as_of DATE;
    END IF;
END $$;

-- 3. Ensure player_dna_cache is indexed for tenure lookups
CREATE INDEX IF NOT EXISTS idx_player_dna_cache_player_tag_date ON public.player_dna_cache(player_tag, date);

-- 4. Verify/Update RLS for new columns (usually handled by table-level RLS)
