-- Player day history table for timeline / historical analytics
-- Date: 2025-10-18

begin;

create table if not exists public.player_day (
  player_tag text not null,
  clan_tag text not null,
  date date not null,
  th smallint,
  league text,
  trophies smallint,
  donations smallint,
  donations_rcv smallint,
  war_stars smallint,
  capital_contrib integer,
  legend_attacks smallint,
  hero_levels jsonb,
  equipment_levels jsonb,
  pets jsonb,
  super_troops_active text[],
  achievements jsonb,
  rush_percent smallint,
  exp_level smallint,
  deltas jsonb not null default '{}'::jsonb,
  events text[] not null default '{}',
  notability smallint not null default 0,
  snapshot_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_tag, date)
);

create index if not exists player_day_clan_date_idx
  on public.player_day (clan_tag, date);

create index if not exists player_day_player_date_idx
  on public.player_day (player_tag, date);

create or replace function public.set_player_day_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists player_day_set_updated_at on public.player_day;

create trigger player_day_set_updated_at
  before update on public.player_day
  for each row
  execute function public.set_player_day_updated_at();

alter table public.player_day enable row level security;

drop policy if exists "Service role full access" on public.player_day;
create policy "Service role full access" on public.player_day
  for all using (auth.role() = 'service_role');

drop policy if exists "Authenticated read access" on public.player_day;
create policy "Authenticated read access" on public.player_day
  for select using (auth.role() = 'authenticated');

comment on table public.player_day is
  'Per-day player snapshot history derived from canonical snapshots.';

comment on column public.player_day.deltas is
  'Structured numeric deltas between consecutive snapshots (e.g., trophies, hero levels).';

comment on column public.player_day.events is
  'Timeline event identifiers for UI timeline scrubber.';

comment on column public.player_day.notability is
  'Notability score (0..N) used to gate timeline markers.';

comment on column public.player_day.snapshot_hash is
  'Hash of core fields to detect duplicate daily rows.';

commit;
