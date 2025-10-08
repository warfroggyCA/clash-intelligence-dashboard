-- Enable Row Level Security on all public tables
-- This migration enables RLS and creates secure policies for all tables

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.smart_insights_payloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_snapshot_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.war_prep_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.war_attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.war_defenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capital_raid_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capital_attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_tenure_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES
-- Policy Strategy:
-- 1. Service role (backend) has full access (bypass RLS)
-- 2. Authenticated users have read access (your API routes use authenticated client)
-- 3. Anonymous/public users have NO access
-- ============================================================================

-- smart_insights_payloads
CREATE POLICY "Service role full access" ON public.smart_insights_payloads FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.smart_insights_payloads FOR SELECT USING (auth.role() = 'authenticated');

-- members
CREATE POLICY "Service role full access" ON public.members FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.members FOR SELECT USING (auth.role() = 'authenticated');

-- roster_snapshots
CREATE POLICY "Service role full access" ON public.roster_snapshots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.roster_snapshots FOR SELECT USING (auth.role() = 'authenticated');

-- member_snapshot_stats
CREATE POLICY "Service role full access" ON public.member_snapshot_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.member_snapshot_stats FOR SELECT USING (auth.role() = 'authenticated');

-- war_prep_pins
CREATE POLICY "Service role full access" ON public.war_prep_pins FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.war_prep_pins FOR SELECT USING (auth.role() = 'authenticated');

-- war_attacks
CREATE POLICY "Service role full access" ON public.war_attacks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.war_attacks FOR SELECT USING (auth.role() = 'authenticated');

-- wars
CREATE POLICY "Service role full access" ON public.wars FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.wars FOR SELECT USING (auth.role() = 'authenticated');

-- war_defenses
CREATE POLICY "Service role full access" ON public.war_defenses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.war_defenses FOR SELECT USING (auth.role() = 'authenticated');

-- capital_raid_seasons
CREATE POLICY "Service role full access" ON public.capital_raid_seasons FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.capital_raid_seasons FOR SELECT USING (auth.role() = 'authenticated');

-- capital_attacks
CREATE POLICY "Service role full access" ON public.capital_attacks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.capital_attacks FOR SELECT USING (auth.role() = 'authenticated');

-- member_tenure_ledger
CREATE POLICY "Service role full access" ON public.member_tenure_ledger FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.member_tenure_ledger FOR SELECT USING (auth.role() = 'authenticated');

-- member_notes
CREATE POLICY "Service role full access" ON public.member_notes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.member_notes FOR SELECT USING (auth.role() = 'authenticated');

-- alerts
CREATE POLICY "Service role full access" ON public.alerts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.alerts FOR SELECT USING (auth.role() = 'authenticated');

-- tasks
CREATE POLICY "Service role full access" ON public.tasks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.tasks FOR SELECT USING (auth.role() = 'authenticated');

-- metrics
CREATE POLICY "Service role full access" ON public.metrics FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.metrics FOR SELECT USING (auth.role() = 'authenticated');

-- clan_settings
CREATE POLICY "Service role full access" ON public.clan_settings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.clan_settings FOR SELECT USING (auth.role() = 'authenticated');

-- ingest_logs
CREATE POLICY "Service role full access" ON public.ingest_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated read access" ON public.ingest_logs FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Query to verify RLS is enabled on all tables
-- Run this after migration to confirm:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename;

-- Query to verify policies exist
-- Run this after migration to confirm:
-- SELECT tablename, policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename, policyname;

