-- Seed Admin Users for Clash Intelligence
-- Run this AFTER setting up auth tables and creating users in Supabase Auth

-- Replace these with your actual admin user emails
-- You'll need to create these users in Supabase Auth first (via Dashboard or API)

-- Example: Create admin user roles
-- Replace 'admin@yourdomain.com' with your actual admin email
-- Replace 'leader@yourdomain.com' with your actual leader email
-- Replace 'coleader@yourdomain.com' with your actual co-leader email

-- IMPORTANT: Create these users in Supabase Auth Dashboard first!
-- Go to Authentication → Users → Invite User

-- Create leader role
SELECT create_user_role(
  'admin@yourdomain.com',  -- Replace with your admin email
  '#2PR8R8V8P',           -- Your clan tag
  'leader',               -- Role
  NULL                    -- Player tag (optional, link to CoC player)
);

-- Create co-leader role (if you have one)
-- SELECT create_user_role(
--   'coleader@yourdomain.com',  -- Replace with co-leader email
--   '#2PR8R8V8P',             -- Your clan tag
--   'coleader',               -- Role
--   NULL                      -- Player tag (optional)
-- );

-- Create elder role (if you have one)
-- SELECT create_user_role(
--   'elder@yourdomain.com',    -- Replace with elder email
--   '#2PR8R8V8P',             -- Your clan tag
--   'elder',                  -- Role
--   NULL                      -- Player tag (optional)
-- );

-- Verify the roles were created
SELECT 
  u.email,
  c.tag as clan_tag,
  c.name as clan_name,
  ur.role,
  ur.player_tag,
  ur.created_at
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
JOIN clans c ON c.id = ur.clan_id
ORDER BY ur.created_at DESC;
