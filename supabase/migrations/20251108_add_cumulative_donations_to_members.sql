-- Add cumulative donation tracking columns to members table
-- These track donations that accumulate over time, resetting when players leave/rejoin
-- Date: 2025-11-08

begin;

-- Add cumulative donation columns
alter table public.members
  add column if not exists cumulative_donations_given integer not null default 0,
  add column if not exists cumulative_donations_received integer not null default 0;

-- Create index for efficient sorting/ranking by cumulative donations
create index if not exists members_cumulative_donations_given_idx 
  on public.members (cumulative_donations_given desc);

create index if not exists members_cumulative_donations_received_idx 
  on public.members (cumulative_donations_received desc);

comment on column public.members.cumulative_donations_given is 
  'Cumulative total of donations given during current clan tenure. Resets when player leaves/rejoins. Handles CoC season resets.';

comment on column public.members.cumulative_donations_received is 
  'Cumulative total of donations received during current clan tenure. Resets when player leaves/rejoins. Handles CoC season resets.';

commit;

