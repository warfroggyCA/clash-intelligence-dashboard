-- Authentication and User Roles Setup for Clash Intelligence
-- Run this in your Supabase SQL editor

-- Create clans table (if not exists)
CREATE TABLE IF NOT EXISTS clans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('leader', 'coleader', 'elder', 'member', 'viewer')),
  player_tag TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, clan_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_clan_id ON user_roles(clan_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Enable Row Level Security
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view roles for clans they're members of" ON user_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.clan_id = user_roles.clan_id
    )
  );

-- RLS Policies for clans
CREATE POLICY "Anyone can view clans" ON clans
  FOR SELECT USING (true);

-- Insert your clan (replace with your actual clan data)
INSERT INTO clans (tag, name) VALUES ('#2PR8R8V8P', 'Your Clan Name')
ON CONFLICT (tag) DO UPDATE SET name = EXCLUDED.name;

-- Function to create a user role (for seeding)
CREATE OR REPLACE FUNCTION create_user_role(
  user_email TEXT,
  clan_tag TEXT,
  role_name TEXT,
  player_tag TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  user_uuid UUID;
  clan_uuid UUID;
  role_uuid UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO user_uuid FROM auth.users WHERE email = user_email;
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Get clan ID from tag
  SELECT id INTO clan_uuid FROM clans WHERE tag = clan_tag;
  
  IF clan_uuid IS NULL THEN
    RAISE EXCEPTION 'Clan with tag % not found', clan_tag;
  END IF;
  
  -- Insert or update user role
  INSERT INTO user_roles (user_id, clan_id, role, player_tag)
  VALUES (user_uuid, clan_uuid, role_name, player_tag)
  ON CONFLICT (user_id, clan_id) 
  DO UPDATE SET 
    role = EXCLUDED.role,
    player_tag = EXCLUDED.player_tag,
    updated_at = NOW()
  RETURNING id INTO role_uuid;
  
  RETURN role_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
