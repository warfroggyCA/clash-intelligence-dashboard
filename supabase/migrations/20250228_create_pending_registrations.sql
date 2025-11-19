-- Pending registrations for in-game verification
-- Date: 2025-02-28

begin;

create extension if not exists pgcrypto;

create table if not exists public.pending_registrations (
  id uuid primary key default gen_random_uuid(),
  clan_tag text not null,
  player_tag text not null,
  verification_code text not null,
  status text not null default 'pending',
  expires_at timestamptz not null default timezone('utc', now()) + interval '24 hours',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  constraint pending_registrations_status_check
    check (status in ('pending', 'approved', 'rejected', 'expired'))
);

create unique index if not exists pending_registrations_code_idx
  on public.pending_registrations (verification_code);

create index if not exists pending_registrations_clan_status_idx
  on public.pending_registrations (clan_tag, status);

create index if not exists pending_registrations_player_clan_idx
  on public.pending_registrations (player_tag, clan_tag);

create index if not exists pending_registrations_expires_idx
  on public.pending_registrations (expires_at);

create or replace function public.set_pending_registrations_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists pending_registrations_set_updated_at on public.pending_registrations;
create trigger pending_registrations_set_updated_at
  before update on public.pending_registrations
  for each row execute function public.set_pending_registrations_updated_at();

alter table public.pending_registrations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pending_registrations'
      and policyname = 'Allow all operations on pending_registrations'
  ) then
    create policy "Allow all operations on pending_registrations"
      on public.pending_registrations
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

comment on table public.pending_registrations is 'Stores pending clan member registrations awaiting leadership approval';

commit;
