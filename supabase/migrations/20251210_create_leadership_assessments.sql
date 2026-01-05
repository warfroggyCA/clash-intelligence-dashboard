create table if not exists leadership_assessments (
  id uuid primary key default gen_random_uuid(),
  clan_tag text not null,
  roster_snapshot_id uuid,
  period_start timestamptz not null,
  period_end timestamptz not null,
  run_type text not null default 'manual',
  data_version text,
  config jsonb,
  summary jsonb,
  created_at timestamptz not null default now()
);

create index if not exists leadership_assessments_clan_tag_created_at_idx
  on leadership_assessments (clan_tag, created_at desc);

create table if not exists leadership_assessment_results (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references leadership_assessments(id) on delete cascade,
  clan_tag text not null,
  member_id uuid,
  player_tag text,
  player_name text,
  role text,
  town_hall integer,
  tenure_days integer,
  clv_score numeric(6,2),
  band text,
  recommendation text,
  flags text[],
  metrics jsonb,
  created_at timestamptz not null default now()
);

create index if not exists leadership_assessment_results_assessment_idx
  on leadership_assessment_results (assessment_id);

create index if not exists leadership_assessment_results_player_tag_idx
  on leadership_assessment_results (player_tag);

create index if not exists leadership_assessment_results_clan_tag_idx
  on leadership_assessment_results (clan_tag);
