-- Enable Row Level Security on CWL tables
-- Date: 2025-12-07
-- Fixes security warnings for: cwl_seasons, cwl_eligible_members, cwl_opponents, cwl_day_lineups, cwl_day_results

BEGIN;

-- ============================================================================
-- ENABLE RLS ON CWL TABLES
-- ============================================================================

ALTER TABLE IF EXISTS public.cwl_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cwl_eligible_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cwl_opponents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cwl_day_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cwl_day_results ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES
-- Policy Strategy:
-- 1. Service role (backend API routes) has full access (bypass RLS)
-- 2. Authenticated users have read access (for future client-side access)
-- 3. Anonymous/public users have NO access
-- ============================================================================

-- cwl_seasons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_seasons'
      AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON public.cwl_seasons
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_seasons'
      AND policyname = 'Authenticated read access'
  ) THEN
    CREATE POLICY "Authenticated read access" ON public.cwl_seasons
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- cwl_eligible_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_eligible_members'
      AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON public.cwl_eligible_members
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_eligible_members'
      AND policyname = 'Authenticated read access'
  ) THEN
    CREATE POLICY "Authenticated read access" ON public.cwl_eligible_members
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- cwl_opponents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_opponents'
      AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON public.cwl_opponents
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_opponents'
      AND policyname = 'Authenticated read access'
  ) THEN
    CREATE POLICY "Authenticated read access" ON public.cwl_opponents
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- cwl_day_lineups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_day_lineups'
      AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON public.cwl_day_lineups
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_day_lineups'
      AND policyname = 'Authenticated read access'
  ) THEN
    CREATE POLICY "Authenticated read access" ON public.cwl_day_lineups
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- cwl_day_results
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_day_results'
      AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON public.cwl_day_results
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cwl_day_results'
      AND policyname = 'Authenticated read access'
  ) THEN
    CREATE POLICY "Authenticated read access" ON public.cwl_day_results
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to confirm RLS is enabled:
--
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('cwl_seasons', 'cwl_eligible_members', 'cwl_opponents', 'cwl_day_lineups', 'cwl_day_results')
-- ORDER BY tablename;
--
-- SELECT tablename, policyname, cmd 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('cwl_seasons', 'cwl_eligible_members', 'cwl_opponents', 'cwl_day_lineups', 'cwl_day_results')
-- ORDER BY tablename, policyname;

