-- Add builder base and war-related columns to player_day for richer daily tracking
-- Date: 2025-02-17

begin;

alter table public.player_day
  add column if not exists attack_wins smallint,
  add column if not exists defense_wins smallint,
  add column if not exists builder_hall_level smallint,
  add column if not exists builder_battle_wins smallint,
  add column if not exists builder_trophies smallint;

comment on column public.player_day.attack_wins is
  'Total war attack wins recorded on this date.';

comment on column public.player_day.defense_wins is
  'Total defensive wins recorded on this date.';

comment on column public.player_day.builder_hall_level is
  'Builder Hall level captured for the day.';

comment on column public.player_day.builder_battle_wins is
  'Builder base battle wins as of this snapshot.';

comment on column public.player_day.builder_trophies is
  'Builder base trophies as of this snapshot.';

commit;
