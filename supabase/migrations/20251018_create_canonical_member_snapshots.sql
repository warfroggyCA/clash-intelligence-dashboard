-- Canonical member snapshot store
-- Date: 2025-10-18

begin;

create table if not exists public.canonical_member_snapshots (
  id uuid primary key default gen_random_uuid(),
  clan_tag text not null,
  player_tag text not null,
  snapshot_id uuid not null references public.roster_snapshots(id) on delete cascade,
  snapshot_date date not null,
  schema_version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (snapshot_id, player_tag)
);

create index if not exists canonical_member_snapshots_clan_tag_idx
  on public.canonical_member_snapshots (clan_tag, snapshot_date desc);

create index if not exists canonical_member_snapshots_player_idx
  on public.canonical_member_snapshots (player_tag, snapshot_date desc);

create or replace function public.set_canonical_member_snapshots_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists canonical_member_snapshots_set_updated_at
  on public.canonical_member_snapshots;

create trigger canonical_member_snapshots_set_updated_at
  before update on public.canonical_member_snapshots
  for each row
  execute function public.set_canonical_member_snapshots_updated_at();

alter table public.canonical_member_snapshots enable row level security;

drop policy if exists "Service role full access" on public.canonical_member_snapshots;
create policy "Service role full access" on public.canonical_member_snapshots
  for all using (auth.role() = 'service_role');

drop policy if exists "Authenticated read access" on public.canonical_member_snapshots;
create policy "Authenticated read access" on public.canonical_member_snapshots
  for select using (auth.role() = 'authenticated');

comment on table public.canonical_member_snapshots is
  'Precomputed canonical member snapshots used as the single source of truth for roster and profile APIs.';

comment on column public.canonical_member_snapshots.payload is
  'Canonical member snapshot payload (JSON) for schema version canonical-member-snapshot/v1.';

commit;
