# Supabase Schema Setup for Clash Intelligence Dashboard

## Overview
This document outlines the database schema setup required to support the strategic dashboard vision and transform the application into an indispensable war room command center.

## 1. Create the Core Tables

Run the following SQL in the Supabase SQL editor in order:

### Clans & Members
```sql
-- Clans & Members
create table public.clans (
  id uuid primary key default gen_random_uuid(),
  tag text not null unique,
  name text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  tag text not null,
  name text,
  th_level int,
  role text,
  league jsonb,
  builder_league jsonb,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clan_id, tag)
);
```

### Roster Snapshots
```sql
-- Roster snapshots
create table public.roster_snapshots (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  fetched_at timestamptz not null,
  member_count int not null,
  total_trophies int,
  total_donations int,
  payload jsonb not null, -- raw snapshot
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index roster_snapshots_clan_fetched_idx on public.roster_snapshots (clan_id, fetched_at desc);

create table public.member_snapshot_stats (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.roster_snapshots(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  th_level int,
  role text,
  trophies int,
  donations int,
  donations_received int,
  hero_levels jsonb,      -- {bk:65, aq:75, ...}
  builder_levels jsonb,
  activity_score numeric,
  rush_percent numeric,
  participation jsonb,
  extras jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_id, member_id)
);
```

### War Data
```sql
-- War data
create table public.wars (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  war_id text not null,
  start_time timestamptz,
  end_time timestamptz,
  state text,
  result text,
  opponent jsonb,
  team_size int,
  attacks_per_member int,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (clan_id, war_id)
);

create table public.war_attacks (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references public.wars(id) on delete cascade,
  attacker_member_id uuid references public.members(id) on delete set null,
  defender jsonb,
  stars int,
  destruction numeric,
  order_index int,
  town_hall_diff int,
  is_cleanup boolean,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.war_defenses (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references public.wars(id) on delete cascade,
  defender_member_id uuid references public.members(id) on delete set null,
  attacker jsonb,
  stars_against int,
  destruction_against numeric,
  order_index int,
  metadata jsonb,
  created_at timestamptz not null default now()
);
```

### Capital Raids
```sql
-- Capital raids
create table public.capital_raid_seasons (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  season_start date not null,
  season_end date not null,
  total_loot int,
  total_attacks int,
  payload jsonb,
  created_at timestamptz not null default now(),
  unique (clan_id, season_start)
);

create table public.capital_attacks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.capital_raid_seasons(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  district text,
  destruction numeric,
  loot int,
  metadata jsonb,
  created_at timestamptz not null default now()
);
```

### Tenure & Metrics
```sql
-- Tenure ledger
create table public.tenure_ledger (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  effective_days int not null,
  as_of_date date not null,
  source text,
  created_at timestamptz not null default now()
);

-- Derived metrics
create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid references public.clans(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  metric_name text not null,
  metric_window text,
  value numeric,
  metadata jsonb,
  computed_at timestamptz not null default now()
);

create index metrics_lookup_idx on public.metrics (clan_id, member_id, metric_name, metric_window);
```

### Alerts & Tasks
```sql
-- Alerts & tasks
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  alert_type text not null,
  status text not null default 'open',
  triggered_at timestamptz not null default now(),
  resolved_at timestamptz,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open',
  due_at timestamptz,
  assigned_to_member_id uuid references public.members(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Notes & Collaboration
```sql
-- Notes
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Users & roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clan_id uuid not null references public.clans(id) on delete cascade,
  player_tag text,
  role text not null, -- leader, coleader, elder, member, viewer, etc.
  created_at timestamptz not null default now(),
  unique (user_id, clan_id)
);
```

### Settings & Logging
```sql
-- Clan settings
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  key text not null,
  value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clan_id, key)
);

-- Ingest logs
create table public.ingest_logs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  clan_id uuid references public.clans(id),
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  details jsonb
);
```

## 2. Optional Indexes / Views

Add additional indexes based on query patterns once we start implementing features:

```sql
-- Additional indexes for performance
create index members_tag_idx on public.members (tag);
create index alerts_status_idx on public.alerts (status);
create index alerts_clan_status_idx on public.alerts (clan_id, status);
create index tasks_clan_status_idx on public.tasks (clan_id, status);
create index notes_member_created_idx on public.notes (member_id, created_at desc);
```

## 3. Row-Level Security

**Note**: Leave RLS disabled for now until we finalize auth flows, but prepare for future implementation:

```sql
-- Future RLS policies (to be implemented)
alter table public.clans enable row level security;
alter table public.members enable row level security;
alter table public.roster_snapshots enable row level security;
alter table public.wars enable row level security;
alter table public.alerts enable row level security;
alter table public.notes enable row level security;
alter table public.user_roles enable row level security;

-- Example policies (to be implemented):
-- Policies for leaders vs members vs viewers will be added here
```

## 4. Seed Minimal Data

Insert the home clan for initial testing:

```sql
insert into public.clans (tag, name) values ('#2PR8R8V8P', 'Clash Intelligence') on conflict (tag) do nothing;
```

## Schema Benefits for Strategic Vision

This schema supports all 8 intelligence domains:

### 1. War Performance Intelligence Engine
- `wars`, `war_attacks`, `war_defenses` tables enable attack efficiency tracking
- `metrics` table for derived war performance calculations
- Support for cleanup efficiency, defensive hold rates, contribution consistency

### 2. Capital Raid Economy Mastery
- `capital_raid_seasons`, `capital_attacks` for comprehensive capital analytics
- Individual and clan-wide efficiency tracking
- Carry score quantification and ROI analysis

### 3. Engagement & Readiness Quantification
- `member_snapshot_stats` tracks long-term trends
- `tenure_ledger` for engagement patterns
- Activity scoring and burnout prediction support

### 4. Momentum & Trend Intelligence
- Historical snapshot data enables rolling performance analysis
- `metrics` table for trend calculations
- Clan evolution tracking over time

### 5. Recruitment Crystal Ball
- `members` table with comprehensive player data
- `metrics` for composite scoring
- AI-assisted evaluation support

### 6. Signature Smart Insights Engine
- `alerts` table for automated intelligence
- `metrics` for insight calculations
- Resilient architecture support

### 7. Revolutionary Perspective Unlocking
- JSONB fields for flexible analytics
- `metrics` table for complex calculations
- Player DNA and clan momentum support

### 8. Leadership Alignment & Proactivity System
- `alerts`, `tasks`, `notes` for collaboration
- `user_roles` for access control
- Real-time coordination support

## Next Steps

1. **Run the schema setup** in Supabase SQL editor
2. **Test basic CRUD operations** with the seed data
3. **Begin implementing** the ingestion pipeline to populate tables
4. **Develop API endpoints** for dashboard data access
5. **Build the intelligence engines** using the structured data

This schema provides the foundation for transforming the dashboard into the indispensable war room command center outlined in the strategic vision.


