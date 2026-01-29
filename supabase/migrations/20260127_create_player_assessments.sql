-- Player assessments (append-only) + latest pointer
-- Date: 2026-01-27

begin;

-- ============================================================================
-- TABLE: player_assessments
-- Append-only, per-clan per-player assessments (freeform notes + context)
-- ============================================================================
create table if not exists public.player_assessments (
  id uuid primary key default gen_random_uuid(),
  clan_tag text not null,
  player_tag text not null,
  player_name text,

  -- Freeform notes from leadership
  notes text not null,

  -- Optional context payload so we can snapshot what we saw at assessment time
  -- (e.g., TH, trophies, donations, vip score, role, etc.) without depending on future snapshots.
  context jsonb not null default '{}'::jsonb,

  assessed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists player_assessments_clan_player_assessed_at_idx
  on public.player_assessments (clan_tag, player_tag, assessed_at desc);

create index if not exists player_assessments_player_tag_idx
  on public.player_assessments (player_tag);

create index if not exists player_assessments_clan_tag_idx
  on public.player_assessments (clan_tag);

comment on table public.player_assessments is 'Append-only freeform leadership assessments per clan + player.';

-- ============================================================================
-- TABLE: player_assessment_latest
-- Fast pointer to the latest assessment per clan/player
-- ============================================================================
create table if not exists public.player_assessment_latest (
  clan_tag text not null,
  player_tag text not null,
  assessment_id uuid not null references public.player_assessments(id) on delete cascade,
  assessed_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (clan_tag, player_tag)
);

create index if not exists player_assessment_latest_assessment_id_idx
  on public.player_assessment_latest (assessment_id);

comment on table public.player_assessment_latest is 'Latest assessment pointer per clan/player for quick reads.';

-- ============================================================================
-- RLS
-- Mirror existing pattern: "Allow all operations" (can tighten later)
-- ============================================================================
alter table public.player_assessments enable row level security;
alter table public.player_assessment_latest enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'player_assessments'
      and policyname = 'Allow all operations on player assessments'
  ) then
    create policy "Allow all operations on player assessments"
      on public.player_assessments
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'player_assessment_latest'
      and policyname = 'Allow all operations on player assessment latest'
  ) then
    create policy "Allow all operations on player assessment latest"
      on public.player_assessment_latest
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

commit;
