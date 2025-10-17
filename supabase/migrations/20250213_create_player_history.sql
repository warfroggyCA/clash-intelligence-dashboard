-- Player history storage
-- Date: 2025-02-13

begin;

create table if not exists public.player_history (
  id uuid primary key default gen_random_uuid(),
  clan_tag text not null,
  player_tag text not null,
  primary_name text not null,
  status text not null default 'applicant',
  total_tenure integer default 0,
  current_stint jsonb,
  movements jsonb not null default '[]'::jsonb,
  aliases jsonb not null default '[]'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (clan_tag, player_tag)
);

create index if not exists player_history_clan_tag_idx
  on public.player_history (clan_tag);

create index if not exists player_history_player_tag_idx
  on public.player_history (player_tag);

create index if not exists player_history_status_idx
  on public.player_history (status);

create or replace function public.set_player_history_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists player_history_set_updated_at on public.player_history;
create trigger player_history_set_updated_at
  before update on public.player_history
  for each row execute function public.set_player_history_updated_at();

alter table public.player_history enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'player_history'
      and policyname = 'Allow all operations on player_history'
  ) then
    create policy "Allow all operations on player_history"
      on public.player_history
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

comment on table public.player_history is 'Tracks player lifecycle history (departures, returns, aliases, notes) per clan.';

commit;

