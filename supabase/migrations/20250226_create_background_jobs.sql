begin;

create extension if not exists pgcrypto;

create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null default 'pending',
  payload jsonb,
  result jsonb,
  error text,
  attempts integer not null default 0,
  job_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists background_jobs_job_type_idx on public.background_jobs (job_type);
create index if not exists background_jobs_status_idx on public.background_jobs (status);
create index if not exists background_jobs_job_key_idx on public.background_jobs (job_key);

create or replace function public.set_background_jobs_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists background_jobs_set_updated_at on public.background_jobs;
create trigger background_jobs_set_updated_at
  before update on public.background_jobs
  for each row
  execute function public.set_background_jobs_updated_at();

commit;
