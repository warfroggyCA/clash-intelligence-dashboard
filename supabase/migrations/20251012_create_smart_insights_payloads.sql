begin;

create table if not exists public.smart_insights_payloads (
  id bigserial primary key,
  clan_tag text not null,
  snapshot_date date not null,
  snapshot_id text,
  source text not null default 'unknown',
  schema_version text not null,
  generated_at timestamptz not null default now(),
  processing_time_ms integer,
  primary_headline text,
  payload jsonb not null,
  diagnostics jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clan_tag, snapshot_date)
);

create index if not exists smart_insights_payloads_clan_tag_idx
  on public.smart_insights_payloads (clan_tag);

create index if not exists smart_insights_payloads_generated_at_idx
  on public.smart_insights_payloads (generated_at desc);

create or replace function public.set_smart_insights_payloads_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists smart_insights_payloads_set_updated_at
  on public.smart_insights_payloads;

create trigger smart_insights_payloads_set_updated_at
  before update on public.smart_insights_payloads
  for each row
  execute function public.set_smart_insights_payloads_updated_at();

commit;
