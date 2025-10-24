-- War, capital, and activity tracking tables
-- Date: 2025-02-16

begin;

-- ============================================================================
-- 1️⃣ CLAN WAR STORAGE
-- ============================================================================

create table if not exists public.clan_wars (
  id uuid primary key default gen_random_uuid(),
  clan_tag text not null,
  opponent_tag text,
  opponent_name text,
  opponent_level integer,
  war_type text not null default 'regular', -- regular | cwl | friendly
  state text not null,
  result text,
  preparation_start timestamptz,
  battle_start timestamptz,
  battle_end timestamptz,
  team_size integer,
  attacks_per_member integer,
  clan_stars integer,
  clan_destruction numeric(6,2),
  opponent_stars integer,
  opponent_destruction numeric(6,2),
  collected_at timestamptz not null default timezone('utc', now()),
  raw jsonb,
  unique (clan_tag, war_type, battle_start)
);

create index if not exists clan_wars_clan_tag_idx
  on public.clan_wars (clan_tag);

create index if not exists clan_wars_battle_start_idx
  on public.clan_wars (battle_start);

create table if not exists public.clan_war_clans (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references public.clan_wars(id) on delete cascade,
  clan_tag text not null,
  clan_name text,
  clan_level integer,
  badge jsonb,
  stars integer,
  destruction numeric(6,2),
  attacks_used integer,
  exp_earned integer,
  is_home boolean not null default false,
  unique (war_id, clan_tag)
);

create index if not exists clan_war_clans_war_idx
  on public.clan_war_clans (war_id);

create table if not exists public.clan_war_members (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references public.clan_wars(id) on delete cascade,
  clan_tag text not null,
  player_tag text not null,
  player_name text,
  town_hall_level integer,
  map_position integer,
  attacks integer,
  stars integer,
  destruction numeric(6,2),
  defense_count integer,
  defense_destruction numeric(6,2),
  is_home boolean not null default true,
  raw jsonb,
  unique (war_id, player_tag)
);

create index if not exists clan_war_members_war_idx
  on public.clan_war_members (war_id);

create index if not exists clan_war_members_player_idx
  on public.clan_war_members (player_tag);

create table if not exists public.clan_war_attacks (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references public.clan_wars(id) on delete cascade,
  attacker_tag text not null,
  attacker_name text,
  defender_tag text not null,
  defender_name text,
  attacker_clan_tag text,
  defender_clan_tag text,
  order_index integer,
  stars integer not null,
  destruction numeric(6,2) not null,
  duration integer,
  is_best_attack boolean,
  attack_time timestamptz,
  raw jsonb,
  unique (war_id, attacker_tag, defender_tag, order_index)
);

create index if not exists clan_war_attacks_war_idx
  on public.clan_war_attacks (war_id);

create index if not exists clan_war_attacks_attacker_idx
  on public.clan_war_attacks (attacker_tag);

-- Updated-at trigger helper
create or replace function public.set_clan_wars_updated_at()
returns trigger as $$
begin
  new.collected_at = coalesce(new.collected_at, timezone('utc', now()));
  return new;
end;
$$ language plpgsql;

drop trigger if exists clan_wars_touch_collected_at on public.clan_wars;
create trigger clan_wars_touch_collected_at
  before update on public.clan_wars
  for each row execute function public.set_clan_wars_updated_at();

-- Enable RLS and permissive policy (service role only in production)
alter table public.clan_wars enable row level security;
alter table public.clan_war_clans enable row level security;
alter table public.clan_war_members enable row level security;
alter table public.clan_war_attacks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clan_wars'
      and policyname = 'Allow all operations on clan_wars'
  ) then
    create policy "Allow all operations on clan_wars"
      on public.clan_wars
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clan_war_clans'
      and policyname = 'Allow all operations on clan_war_clans'
  ) then
    create policy "Allow all operations on clan_war_clans"
      on public.clan_war_clans
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clan_war_members'
      and policyname = 'Allow all operations on clan_war_members'
  ) then
    create policy "Allow all operations on clan_war_members"
      on public.clan_war_members
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clan_war_attacks'
      and policyname = 'Allow all operations on clan_war_attacks'
  ) then
    create policy "Allow all operations on clan_war_attacks"
      on public.clan_war_attacks
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

comment on table public.clan_wars is 'Tracks individual clan wars (regular, CWL, friendly) for analytics and dashboards.';
comment on table public.clan_war_clans is 'Per-clan snapshot for each war, storing stars, destruction, and badge metadata.';
comment on table public.clan_war_members is 'Per-member war performance summary for both allied and opponent clans.';
comment on table public.clan_war_attacks is 'Attack-level detail for clan wars, including stars, destruction, and timing.';

-- ============================================================================
-- 2️⃣ CAPITAL RAID TRACKING
-- ============================================================================

create table if not exists public.capital_raid_seasons (
  id uuid primary key default gen_random_uuid(),
  clan_tag text not null,
  season_id text not null,
  start_date date not null,
  end_date date not null,
  total_raids integer,
  total_loot bigint,
  total_destruction numeric(8,2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  raw jsonb,
  unique (clan_tag, season_id)
);

create index if not exists capital_raid_seasons_clan_idx
  on public.capital_raid_seasons (clan_tag);

create table if not exists public.capital_raid_weekends (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.capital_raid_seasons(id) on delete cascade,
  weekend_id text not null,
  start_time timestamptz,
  end_time timestamptz,
  state text,
  enemy_count integer,
  total_loot bigint,
  total_destruction numeric(8,2),
  raw jsonb,
  unique (season_id, weekend_id)
);

create index if not exists capital_raid_weekends_season_idx
  on public.capital_raid_weekends (season_id);

create table if not exists public.capital_raid_participants (
  id uuid primary key default gen_random_uuid(),
  weekend_id uuid not null references public.capital_raid_weekends(id) on delete cascade,
  player_tag text not null,
  player_name text,
  attack_count integer,
  total_loot bigint,
  bonus_loot bigint,
  capital_resources_looted bigint,
  raw jsonb,
  unique (weekend_id, player_tag)
);

create index if not exists capital_raid_participants_weekend_idx
  on public.capital_raid_participants (weekend_id);

create index if not exists capital_raid_participants_player_idx
  on public.capital_raid_participants (player_tag);

create or replace function public.set_capital_raid_seasons_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists capital_raid_seasons_set_updated_at on public.capital_raid_seasons;
create trigger capital_raid_seasons_set_updated_at
  before update on public.capital_raid_seasons
  for each row execute function public.set_capital_raid_seasons_updated_at();

alter table public.capital_raid_seasons enable row level security;
alter table public.capital_raid_weekends enable row level security;
alter table public.capital_raid_participants enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'capital_raid_seasons'
      and policyname = 'Allow all operations on capital_raid_seasons'
  ) then
    create policy "Allow all operations on capital_raid_seasons"
      on public.capital_raid_seasons
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'capital_raid_weekends'
      and policyname = 'Allow all operations on capital_raid_weekends'
  ) then
    create policy "Allow all operations on capital_raid_weekends"
      on public.capital_raid_weekends
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'capital_raid_participants'
      and policyname = 'Allow all operations on capital_raid_participants'
  ) then
    create policy "Allow all operations on capital_raid_participants"
      on public.capital_raid_participants
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

comment on table public.capital_raid_seasons is 'Season-level summary for clan capital raids.';
comment on table public.capital_raid_weekends is 'Weekend raid runs inside a season, including aggregate loot and opponents.';
comment on table public.capital_raid_participants is 'Per-player raid contributions (attacks, loot, bonuses).';

-- ============================================================================
-- 3️⃣ CLAN GAMES PARTICIPATION
-- ============================================================================

create table if not exists public.clan_game_seasons (
  id uuid primary key default gen_random_uuid(),
  clan_tag text not null,
  season_id text not null,
  start_date date,
  end_date date,
  reward_tier integer,
  total_points integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  raw jsonb,
  unique (clan_tag, season_id)
);

create table if not exists public.clan_game_participants (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.clan_game_seasons(id) on delete cascade,
  player_tag text not null,
  player_name text,
  points integer not null,
  reward_claimed boolean,
  raw jsonb,
  unique (season_id, player_tag)
);

create index if not exists clan_game_seasons_clan_idx
  on public.clan_game_seasons (clan_tag);

create index if not exists clan_game_participants_player_idx
  on public.clan_game_participants (player_tag);

create or replace function public.set_clan_game_seasons_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists clan_game_seasons_set_updated_at on public.clan_game_seasons;
create trigger clan_game_seasons_set_updated_at
  before update on public.clan_game_seasons
  for each row execute function public.set_clan_game_seasons_updated_at();

alter table public.clan_game_seasons enable row level security;
alter table public.clan_game_participants enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clan_game_seasons'
      and policyname = 'Allow all operations on clan_game_seasons'
  ) then
    create policy "Allow all operations on clan_game_seasons"
      on public.clan_game_seasons
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clan_game_participants'
      and policyname = 'Allow all operations on clan_game_participants'
  ) then
    create policy "Allow all operations on clan_game_participants"
      on public.clan_game_participants
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

comment on table public.clan_game_seasons is 'Stores clan games season metadata and total points.';
comment on table public.clan_game_participants is 'Tracks player-level clan games participation and rewards.';

-- ============================================================================
-- 4️⃣ NORMALIZED PLAYER ACTIVITY EVENTS
-- ============================================================================

create table if not exists public.player_activity_events (
  id uuid primary key default gen_random_uuid(),
  clan_tag text not null,
  player_tag text not null,
  event_type text not null, -- e.g. war_attack, capital_raid, clan_game, donation_spike
  source text not null,     -- ingestion source identifier
  occurred_at timestamptz not null,
  value numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (clan_tag, player_tag, event_type, source, occurred_at)
);

create index if not exists player_activity_events_player_idx
  on public.player_activity_events (player_tag);

create index if not exists player_activity_events_clan_idx
  on public.player_activity_events (clan_tag);

create index if not exists player_activity_events_type_idx
  on public.player_activity_events (event_type);

alter table public.player_activity_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'player_activity_events'
      and policyname = 'Allow all operations on player_activity_events'
  ) then
    create policy "Allow all operations on player_activity_events"
      on public.player_activity_events
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

comment on table public.player_activity_events is 'Unified activity feed for players, populated from wars, raids, games, and other ingestion sources.';

commit;
