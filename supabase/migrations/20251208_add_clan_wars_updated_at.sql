begin;

alter table public.clan_wars
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.clan_wars
  set updated_at = coalesce(updated_at, collected_at, timezone('utc', now()))
  where updated_at is null;

commit;
