begin;

alter table public.war_plans
  add column if not exists analysis_job_id uuid,
  add column if not exists analysis_started_at timestamptz,
  add column if not exists analysis_completed_at timestamptz,
  add column if not exists analysis_version text;

create index if not exists war_plans_analysis_status_idx on public.war_plans (analysis_status);
create index if not exists war_plans_analysis_job_idx on public.war_plans (analysis_job_id);

comment on column public.war_plans.analysis_status is 'Current state of the stored analysis result.';
comment on column public.war_plans.analysis_version is 'Semantic version for the war plan analysis generator.';

commit;
