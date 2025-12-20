-- Fix function search_path security warnings
-- Date: 2025-12-07
-- Fixes: set_pending_registrations_updated_at, set_clan_game_seasons_updated_at
-- 
-- Security Issue: Functions without a fixed search_path are vulnerable to 
-- search_path manipulation attacks. Setting search_path prevents this.

BEGIN;

-- Fix set_pending_registrations_updated_at
CREATE OR REPLACE FUNCTION public.set_pending_registrations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  new.updated_at = timezone('utc', now());
  RETURN new;
END;
$$;

-- Fix set_clan_game_seasons_updated_at
CREATE OR REPLACE FUNCTION public.set_clan_game_seasons_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  new.updated_at = timezone('utc', now());
  RETURN new;
END;
$$;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, verify the functions have search_path set:
--
-- SELECT 
--   p.proname as function_name,
--   pg_get_functiondef(p.oid) as definition
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('set_pending_registrations_updated_at', 'set_clan_game_seasons_updated_at');









