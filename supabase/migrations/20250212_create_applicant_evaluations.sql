-- Applicant evaluations storage
-- Date: 2025-02-12

begin;

create table if not exists public.applicant_evaluations (
  id uuid primary key default gen_random_uuid(),
  clan_tag text not null,
  player_tag text not null,
  player_name text,
  status text not null default 'shortlisted',
  score numeric,
  recommendation text,
  rush_percent numeric,
  evaluation jsonb not null,
  applicant jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (clan_tag, player_tag)
);

create index if not exists applicant_evaluations_clan_tag_idx
  on public.applicant_evaluations (clan_tag);

create index if not exists applicant_evaluations_status_idx
  on public.applicant_evaluations (status);

create or replace function public.set_applicant_evaluations_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists applicant_evaluations_set_updated_at on public.applicant_evaluations;
create trigger applicant_evaluations_set_updated_at
  before update on public.applicant_evaluations
  for each row execute function public.set_applicant_evaluations_updated_at();

alter table public.applicant_evaluations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'applicant_evaluations'
      and policyname = 'Allow all operations on applicant evaluations'
  ) then
    create policy "Allow all operations on applicant evaluations"
      on public.applicant_evaluations
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

comment on table public.applicant_evaluations is 'Stores applicant evaluation results and statuses for leadership review';

commit;

