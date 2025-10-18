-- Cleanup script for war activity tables migration
-- Run this in Supabase SQL editor before re-running the migration

-- Drop all triggers first
drop trigger if exists clan_wars_touch_collected_at on public.clan_wars;
drop trigger if exists capital_raid_seasons_set_updated_at on public.capital_raid_seasons;
drop trigger if exists clan_game_seasons_set_updated_at on public.clan_game_seasons;

-- Drop all indexes first (including all clan_tag references)
drop index if exists clan_wars_battle_start_idx;
drop index if exists clan_wars_clan_tag_idx;
drop index if exists clan_war_clans_war_idx;
drop index if exists clan_war_members_war_idx;
drop index if exists clan_war_members_player_idx;
drop index if exists clan_war_attacks_war_idx;
drop index if exists clan_war_attacks_attacker_idx;
drop index if exists capital_raid_seasons_clan_idx;
drop index if exists capital_raid_weekends_season_idx;
drop index if exists capital_raid_participants_weekend_idx;
drop index if exists capital_raid_participants_player_idx;
drop index if exists clan_game_seasons_clan_idx;
drop index if exists clan_game_participants_player_idx;
drop index if exists player_activity_events_player_idx;
drop index if exists player_activity_events_clan_idx;
drop index if exists player_activity_events_type_idx;

-- Drop all tables in reverse dependency order
drop table if exists public.player_activity_events cascade;
drop table if exists public.clan_game_participants cascade;
drop table if exists public.clan_game_seasons cascade;
drop table if exists public.capital_raid_participants cascade;
drop table if exists public.capital_raid_weekends cascade;
drop table if exists public.capital_raid_seasons cascade;
drop table if exists public.clan_war_attacks cascade;
drop table if exists public.clan_war_members cascade;
drop table if exists public.clan_war_clans cascade;
drop table if exists public.clan_wars cascade;

-- Drop functions
drop function if exists public.set_clan_wars_updated_at();
drop function if exists public.set_capital_raid_seasons_updated_at();
drop function if exists public.set_clan_game_seasons_updated_at();

-- Verify cleanup
select 'Cleanup complete - ready to re-run migration' as status;
