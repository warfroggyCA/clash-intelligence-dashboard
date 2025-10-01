-- Fix Row Level Security (RLS) for all public tables
-- Run this in your Supabase SQL editor to address security warnings

-- Enable RLS on all tables mentioned in security warnings
ALTER TABLE roster_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_snapshot_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE war_attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE war_defenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_raid_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_tenure_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE clan_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_logs ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for now (you can restrict later)
-- These allow all operations but enable RLS framework

-- Roster and member data policies
CREATE POLICY "Allow all operations on roster_snapshots" 
ON roster_snapshots FOR ALL USING (true);

CREATE POLICY "Allow all operations on member_snapshot_stats" 
ON member_snapshot_stats FOR ALL USING (true);

CREATE POLICY "Allow all operations on members" 
ON members FOR ALL USING (true);

CREATE POLICY "Allow all operations on member_notes" 
ON member_notes FOR ALL USING (true);

CREATE POLICY "Allow all operations on member_tenure_ledger" 
ON member_tenure_ledger FOR ALL USING (true);

-- War data policies
CREATE POLICY "Allow all operations on wars" 
ON wars FOR ALL USING (true);

CREATE POLICY "Allow all operations on war_attacks" 
ON war_attacks FOR ALL USING (true);

CREATE POLICY "Allow all operations on war_defenses" 
ON war_defenses FOR ALL USING (true);

-- Capital raid policies
CREATE POLICY "Allow all operations on capital_raid_seasons" 
ON capital_raid_seasons FOR ALL USING (true);

CREATE POLICY "Allow all operations on capital_attacks" 
ON capital_attacks FOR ALL USING (true);

-- System tables policies
CREATE POLICY "Allow all operations on metrics" 
ON metrics FOR ALL USING (true);

CREATE POLICY "Allow all operations on alerts" 
ON alerts FOR ALL USING (true);

CREATE POLICY "Allow all operations on tasks" 
ON tasks FOR ALL USING (true);

CREATE POLICY "Allow all operations on clan_settings" 
ON clan_settings FOR ALL USING (true);

CREATE POLICY "Allow all operations on ingest_logs" 
ON ingest_logs FOR ALL USING (true);

-- More restrictive policies for sensitive data (optional - uncomment if you want stricter access)
-- These would restrict access to specific clan tags only

/*
-- Example of more restrictive policy for member_notes (sensitive data)
DROP POLICY IF EXISTS "Allow all operations on member_notes" ON member_notes;
CREATE POLICY "Clan-specific member notes access" 
ON member_notes FOR ALL 
USING (clan_tag = '#2PR8R8V8P');  -- Replace with your clan tag

-- Example of more restrictive policy for clan_settings
DROP POLICY IF EXISTS "Allow all operations on clan_settings" ON clan_settings;
CREATE POLICY "Clan-specific settings access" 
ON clan_settings FOR ALL 
USING (clan_tag = '#2PR8R8V8P');  -- Replace with your clan tag
*/
