-- Create tracked_clans table for multi-clan tracking
-- Date: 2025-01-15
-- Stores list of clans being tracked (beyond the home clan)

BEGIN;

CREATE TABLE IF NOT EXISTS public.tracked_clans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL UNIQUE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  added_by TEXT, -- User identifier who added this clan
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT, -- Optional notes about why this clan is tracked
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS tracked_clans_clan_tag_idx ON public.tracked_clans(clan_tag);
CREATE INDEX IF NOT EXISTS tracked_clans_is_active_idx ON public.tracked_clans(is_active);

-- Update trigger function (CREATE OR REPLACE is safe - only updates function definition, not data)
CREATE OR REPLACE FUNCTION public.set_tracked_clans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tracked_clans_set_updated_at
  BEFORE UPDATE ON public.tracked_clans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tracked_clans_updated_at();

-- RLS policies
ALTER TABLE public.tracked_clans ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON public.tracked_clans
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read (for UI display)
CREATE POLICY "Authenticated read access" ON public.tracked_clans
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only leaders can modify (enforced at API level, but good to have DB-level too)
-- Note: We'll rely on API-level checks since RLS doesn't have access to user_roles table easily

COMMENT ON TABLE public.tracked_clans IS 'Stores list of clans being tracked for multi-clan analytics. Only leaders can add/remove clans.';

COMMIT;

