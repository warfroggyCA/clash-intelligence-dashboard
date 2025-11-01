-- War opponent history - tracks opponents we've fought/planned against
-- Date: 2025-01-01
-- 
-- This table records a simple history of opponents we've engaged with,
-- separate from full war records. Useful for quick reference.

begin;

create table if not exists public.war_opponent_history (
  id uuid primary key default gen_random_uuid(),
  our_clan_tag text not null,
  opponent_tag text not null,
  opponent_name text,
  fought_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists war_opponent_history_our_tag_idx
  on public.war_opponent_history (our_clan_tag, fought_at desc);

create index if not exists war_opponent_history_opponent_tag_idx
  on public.war_opponent_history (opponent_tag);

alter table public.war_opponent_history enable row level security;

drop policy if exists "Service role full access" on public.war_opponent_history;
create policy "Service role full access" on public.war_opponent_history
  for all using (auth.role() = 'service_role');

drop policy if exists "Authenticated read access" on public.war_opponent_history;
create policy "Authenticated read access" on public.war_opponent_history
  for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated insert access" on public.war_opponent_history;
create policy "Authenticated insert access" on public.war_opponent_history
  for insert using (auth.role() = 'authenticated');

comment on table public.war_opponent_history is 
  'Simple history of opponents we have fought or planned against. Used for quick reference and avoiding duplicate planning.';

commit;

