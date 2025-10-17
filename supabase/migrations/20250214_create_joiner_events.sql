-- Joiner events storage
-- Date: 2025-02-14

begin;

create table if not exists public.joiner_events (
  id uuid primary key default gen_random_uuid(),
  clan_tag text not null,
  player_tag text not null,
  detected_at timestamptz not null default timezone('utc', now()),
  source_snapshot_id text,
  status text not null default 'pending', -- pending | reviewed
  metadata jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by text,
  unique (clan_tag, player_tag, detected_at)
);

create index if not exists joiner_events_clan_tag_idx
  on public.joiner_events (clan_tag);

create index if not exists joiner_events_status_idx
  on public.joiner_events (status);

alter table public.joiner_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'joiner_events'
      and policyname = 'Allow all operations on joiner_events'
  ) then
    create policy "Allow all operations on joiner_events"
      on public.joiner_events
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

comment on table public.joiner_events is 'Tracks new roster joiners detected by nightly jobs for leadership review.';

commit;

