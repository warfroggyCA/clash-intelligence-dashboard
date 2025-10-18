begin;

-- Add war stats columns to member_snapshot_stats table
alter table public.member_snapshot_stats 
add column if not exists war_stars int,
add column if not exists attack_wins int,
add column if not exists defense_wins int;

-- Add comments for documentation
comment on column public.member_snapshot_stats.war_stars is 'Total war stars earned by this member';
comment on column public.member_snapshot_stats.attack_wins is 'Total attack wins in wars';
comment on column public.member_snapshot_stats.defense_wins is 'Total defense wins in wars';

commit;
