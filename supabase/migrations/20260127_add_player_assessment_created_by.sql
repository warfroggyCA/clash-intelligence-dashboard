-- Add created_by to player_assessments
-- Date: 2026-01-27

begin;

alter table public.player_assessments
  add column if not exists created_by text;

create index if not exists player_assessments_created_by_idx
  on public.player_assessments (created_by);

comment on column public.player_assessments.created_by is 'Identifier for the leader who created the assessment (email/user id).';

commit;
