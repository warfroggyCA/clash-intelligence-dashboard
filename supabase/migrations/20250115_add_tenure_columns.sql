-- Add tenure tracking columns to members and member_snapshot_stats tables
-- This migration adds tenure_days and tenure_as_of columns to support
-- the tenure pipeline that reads from the tenure_ledger and persists
-- calculated tenure values in Supabase

begin;

-- Add tenure columns to members table
alter table public.members
  add column if not exists tenure_days integer default 0,
  add column if not exists tenure_as_of date;

-- Add tenure columns to member_snapshot_stats table  
alter table public.member_snapshot_stats
  add column if not exists tenure_days integer default 0,
  add column if not exists tenure_as_of date;

-- Create indexes for tenure queries
create index if not exists members_tenure_days_idx on public.members (tenure_days);
create index if not exists members_tenure_as_of_idx on public.members (tenure_as_of);
create index if not exists member_snapshot_stats_tenure_days_idx on public.member_snapshot_stats (tenure_days);
create index if not exists member_snapshot_stats_tenure_as_of_idx on public.member_snapshot_stats (tenure_as_of);

-- Add comments for documentation
comment on column public.members.tenure_days is 'Number of days the member has been in the clan, calculated from tenure_ledger';
comment on column public.members.tenure_as_of is 'Date when tenure_days was last calculated';
comment on column public.member_snapshot_stats.tenure_days is 'Number of days the member had been in the clan at the time of this snapshot';
comment on column public.member_snapshot_stats.tenure_as_of is 'Date when tenure_days was calculated for this snapshot';

commit;
