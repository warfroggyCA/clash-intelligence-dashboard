-- Add custom permissions support to clan_access_configs
-- Date: January 25, 2025
-- Allows Leaders to customize permissions for each access level

BEGIN;

-- Add custom_permissions column to store per-level permission overrides
ALTER TABLE public.clan_access_configs
  ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_clan_access_configs_custom_permissions 
  ON public.clan_access_configs USING GIN (custom_permissions);

-- Add comment
COMMENT ON COLUMN public.clan_access_configs.custom_permissions IS 
  'Custom permission overrides per access level. Format: { "viewer": { "canViewRoster": true, ... }, "member": { ... }, ... }. NULL means use defaults.';

COMMIT;

